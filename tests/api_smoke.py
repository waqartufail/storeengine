"""Run against a disposable test deployment. Creates two stores and synthetic orders."""
import concurrent.futures, http.cookiejar, json, os, uuid
from urllib import request, error

base = os.environ.get("TEST_URL", "http://127.0.0.1:5173") + "/api"
uid = uuid.uuid4().hex[:10]
pw = "Demo-facing-qa-" + uid
def client():
    return request.build_opener(request.ProxyHandler({}),request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def call(c, path, method="GET", data=None, want=200):
    req=request.Request(base+path, method=method, data=json.dumps(data).encode() if data is not None else None,
                        headers={"Content-Type":"application/json","X-NW-Request":"portal"})
    try:
        r=c.open(req)
    except error.HTTPError as e:
        r=e
    with r:
        raw=r.read().decode()
        assert r.status==want, (method,path,r.status,want,raw[:600])
        return json.loads(raw) if raw else None

owner, a, b, public = [client() for _ in range(4)]
oc={"email":os.environ["QA_OWNER_EMAIL"],"password":os.environ["QA_OWNER_PASSWORD"]}
call(owner,"/auth/owner/login","POST",oc)
call(public,"/owner/stores",want=401)
def create(c,key):
    login={"email":key+uid+"@example.test","password":pw}
    payload=dict(login,adminName="QA "+key,name="Store "+key)
    shop=call(c,"/auth/signup","POST",payload,201)
    call(c,"/auth/signup","POST",payload,409)
    call(c,"/auth/admin/login","POST",login,403)
    url="/stores/"+shop["slug"]
    call(public,url,want=404)
    listing=call(owner,"/owner/stores")
    row=next(s for s in listing if s["email"]==login["email"].lower())
    decision="/owner/stores/"+str(row["id"])
    call(owner,decision,"PUT",{"action":"Activate","plan":"Trial"})
    call(c,"/auth/admin/login","POST",login)
    return url,login,decision
ua,la,da=create(a,"Alpha")
ub,lb,db=create(b,"Beta")
call(a,"/owner/stores",want=401)
print("PASS signup, duplicate registration, owner-only activation, pending access and separate accounts")
token_path="/admin/couriers/postex/token"
fake_token="qa-only-"+uid
call(public,token_path,"PUT",{"token":fake_token},401)
call(b,token_path,"PUT",{"token":"invalid token"},400)
assert call(b,token_path,"PUT",{"token":fake_token})=={"configured":True}
assert call(b,"/admin/settings")["postExConfigured"]
assert not call(a,"/admin/settings")["postExConfigured"]
assert fake_token not in json.dumps(call(b,"/admin/settings"))
assert fake_token not in json.dumps(call(public,ub))
print("PASS PostEx token is write-only, scoped to the signed-in merchant and excluded from storefront data")
baseProduct=dict(name="Honey",category="Pantry",description="",price=100,stock=12,weightKg=2.5,shippingCharge=85,imageUrl="",promoLabel="10% off",promoKind="Percent",promoValue=10,version=0)
p=call(a,"/admin/products","POST",dict(baseProduct,netQuantity=150,netUnit="g"))
assert p["salePrice"]==90
p=call(a,"/admin/products/"+str(p["id"]),"PUT",dict(baseProduct,version=p["version"],name="Wild honey"))
assert (p["netQuantity"],p["netUnit"])==(150,"g")  # Older editors omit the two fields.
call(a,"/admin/products/"+str(p["id"]),"PUT",baseProduct,409)
call(b,"/admin/products/"+str(p["id"]),"PUT",baseProduct,404)
call(b,"/admin/products/"+str(p["id"])+"?version=2","DELETE",want=404)
assert call(b,"/admin/products")==[] and call(public,ub)["products"]==[]
settings=call(a,"/admin/settings")
brand=dict(settings["brand"],name="Honey House",browserTitle="Honey | Home",theme="emerald",version=settings["version"])
v=call(a,"/admin/brand","PUT",brand)["version"]
call(a,"/admin/brand","PUT",brand,409)
config=settings["config"]
config["payments"][1].update(enabled=True,details="Use merchant reference")
config["couriers"].append({"name":"Local rider","enabled":True,"pickupCode":"","notes":"Ring bell"})
call(a,"/admin/settings","PUT",dict(config=config,version=v))
assert call(public,ua)["brand"]["name"]=="Honey House"
assert len(call(public,ua)["payments"])==2 and len(call(public,ub)["payments"])==1
# Round-trip every original palette and exercise custom/hosted payment configuration.
for theme in ["midnight","royal","ocean","sunset","rose","lavender","minimal","copper","neon","emerald"]:
    state=call(a,"/admin/settings")
    call(a,"/admin/brand","PUT",dict(state["brand"],theme=theme,version=state["version"]))
    assert call(public,ua)["brand"]["theme"]==theme
state=call(a,"/admin/settings")
cfg=state["config"]
card=next(x for x in cfg["payments"] if x["kind"]=="card")
card.update(enabled=True,url="http://checkout.example.test")
call(a,"/admin/settings","PUT",dict(config=cfg,version=state["version"]),400)
card["url"]="https://checkout.example.test/pay"
cfg["payments"].append(dict(name="Custom wallet",kind="online",enabled=True,details="Pay the merchant",qr="",url=""))
call(a,"/admin/settings","PUT",dict(config=cfg,version=state["version"]))
methods=call(public,ua)["payments"]
assert {m["name"] for m in methods}=={"Cash on Delivery","Easypaisa","Card Payment","Custom wallet"}
assert next(x for x in methods if x["kind"]=="card")["url"]==card["url"]
print("PASS all ten persisted themes, custom payment methods and HTTPS hosted card link configuration")
def checkout(items,total,**kw):
    return dict(dict(customerName="QA Client",phone="03001234567",address="Test lane",city="Lahore",paymentMethod="Cash on Delivery",
                     paymentReference="",requestId=str(uuid.uuid4()),items=[{"productId":i,"quantity":q} for i,q in items],expectedTotal=total),**kw)
body=checkout([(p["id"],2)],265)
call(public,ub+"/orders","POST",body,409)
call(public,ua+"/orders","POST",dict(body,expectedTotal=1),409)
o=call(public,ua+"/orders","POST",body)
assert (o["shipping"],o["weightKg"],o["subtotal"])==(85,5,180)
assert call(public,ua+"/orders","POST",body)["id"]==o["id"]
assert call(a,"/admin/products")[0]["stock"]==10
od="/admin/orders/"+str(o["id"])
call(b,od,want=404)
call(b,od+"/status","PATCH",{"status":"Delivered"},404)
call(a,od+"/status","PATCH",{"status":"Confirmed"})
assert call(a,od)["items"][0]["promoLabel"]=="10% off"
call(a,od+"/book","POST",want=400)
print("PASS product editing, tenant isolation, settings concurrency, discounts, 5 kg checkout and idempotency")
q=call(a,"/admin/products","POST",dict(baseProduct,name="Tea",weightKg=.001,shippingCharge=40,promoKind="Fixed",promoLabel="Intro",promoValue=12.5,stock=2))
mixed=checkout([(p["id"],2),(q["id"],1)],402.5,paymentMethod="Easypaisa",paymentReference="RECEIPT-123")
order=call(public,ua+"/orders","POST",mixed)
assert order["shipping"]==135 and order["weightKg"]==5.001
ordpath="/admin/orders/"+str(order["id"])
call(a,ordpath+"/verify-payment","POST")
assert call(a,ordpath)["paymentVerified"]
call(a,ordpath+"/tracking","POST",{"tracking":"QA-123","confirmUnbooked":False})
assert call(a,ordpath)["tracking"]=="QA-123"
def buy_one(_):
    try:
        call(client(),ua+"/orders","POST",checkout([(q["id"],1)],127.5))
        return "ok"
    except AssertionError as e:
        assert e.args[0][2]==409,e
        return "sold out"
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    assert sorted(pool.map(buy_one,range(2)))==["ok","sold out"]
print("PASS fractional excess weight, mixed-product single shipping fee, payment reconciliation and concurrent last-item purchase")
# The same shipping band applies to different labeled contents. Packaging alone crosses the threshold.
size=call(a,"/admin/products","POST",dict(baseProduct,name="Oil",netQuantity=250,netUnit="ml",weightKg=5))
size_path="/admin/products/"+str(size["id"])
def purchase_size(total):
    return call(public,ua+"/orders","POST",checkout([(size["id"],1)],total))
def change_size(**fields):
    current=next(x for x in call(a,"/admin/products") if x["id"]==size["id"])
    return call(a,size_path,"PUT",dict(current,**fields))
first=purchase_size(175)
assert first["shipping"]==85
change_size(netQuantity=100,netUnit="g")
assert purchase_size(175)["shipping"]==85
change_size(weightKg=5.001)
assert purchase_size(225)["shipping"]==135
line=call(a,"/admin/orders/"+str(first["id"]))["items"][0]
assert (line["netQuantity"],line["netUnit"])==(250,"ml")
cleared=change_size(netQuantity=None,netUnit="")
assert cleared["netQuantity"] is None and cleared["netUnit"]==""
for unit,quantity in [("kg",25),("ml",-1),("g",None),("",15),("ml",.0001)]:
    call(a,size_path,"PUT",dict(cleared,netUnit=unit,netQuantity=quantity),400)
print("PASS net g/ml, carry-forward on legacy edits, clearing size, and historical snapshot. Changing product contents preserves the fee; changing only parcel weight changes the fee from 85 to 135.")
for action,plan in [("Deactivate","Trial"),("Activate","Monthly"),("Reject","Monthly"),("Activate","Yearly"),("Activate","Lifetime")]:
    call(owner,da,"PUT",dict(action=action,plan=plan))
    if action=="Activate":
        call(a,"/admin/settings",want=401)
        call(a,"/auth/admin/login","POST",la)
        assert call(a,"/admin/settings")["plan"]==plan
        assert call(public,ua)["brand"]["name"]=="Honey House"
    else:
        call(a,"/admin/products",want=403)
        call(public,ua,want=404)
        call(public,ua+"/orders","POST",body,404)
        assert call(public,ub)["brand"]["name"]=="Store Beta"
assert call(a,"/admin/settings")["expiresAt"] is None
call(a,"/auth/admin/logout","POST",want=204)
call(a,"/admin/settings",want=401)
print("PASS deactivation, rejection, reactivation, plan changes, revoked sessions and logout")
if os.environ.get("QA_DB_DSN"):
    import psycopg
    call(b,"/auth/admin/login","POST",lb)
    with psycopg.connect(os.environ["QA_DB_DSN"]) as conn:
        conn.execute("""UPDATE "Shops" SET "ExpiresAt"=now()-interval '1 second' WHERE "Email"=%s""",(lb["email"].lower(),))
    call(b,"/admin/settings",want=403)
    call(public,ub,want=404)
    call(public,ub+"/orders","POST",body,404)
    assert not any(s["slug"]==ub.split("/")[-1] for s in call(public,"/directory"))
    print("PASS automatic plan expiration blocks the admin session, directory listing, storefront and checkout")
