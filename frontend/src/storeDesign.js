export const sectionNames = {
  hero: "Hero banner",
  collections: "Category showcase",
  featured: "Featured products",
  catalog: "Product catalog",
  story: "Store story",
};
const align = { left: "Left", center: "Center", right: "Right" };
const shelves = {
  grid: "Grid",
  vertical: "Vertical list",
  horizontal: "Horizontal scroll",
};
export const designGroups = {
  header: [
    "Header & logo",
    {
      logoAlign: ["Logo position", { original: "Theme default", ...align }],
      logoShape: [
        "Logo shape",
        {
          rounded: "Rounded",
          circle: "Circle",
          square: "Square",
          natural: "Original proportions",
        },
      ],
      logoSize: [
        "Logo size",
        { normal: "Medium", small: "Small", large: "Large" },
      ],
      logoText: [
        "Store name beside logo",
        { beside: "Beside logo", below: "Below logo", hidden: "Logo only" },
      ],
    },
  ],
  hero: [
    "Hero banner",
    {
      heroStyle: [
        "Banner layout",
        { cover: "Full cover", left: "Photo on left", right: "Photo on right" },
      ],
      heroAlign: [
        "Banner text alignment",
        { original: "Theme default", ...align },
      ],
    },
  ],
  collections: [
    "Category showcase",
    { categoriesLayout: ["Category layout", shelves] },
  ],
  featured: [
    "Featured products",
    { featuredLayout: ["Featured product layout", shelves] },
  ],
  catalog: [
    "Catalog & filters",
    {
      productLayout: ["Product layout", shelves],
      filterPosition: [
        "Filter position",
        { top: "Above products", left: "Left sidebar", right: "Right sidebar" },
      ],
      filterStyle: [
        "Category filter style",
        { chips: "Buttons", select: "Dropdown" },
      ],
    },
  ],
  story: [
    "Store story",
    {
      storyLayout: [
        "Story layout",
        { vertical: "Stacked", horizontal: "Side by side" },
      ],
      storyAlign: [
        "Story text alignment",
        { original: "Theme default", ...align },
      ],
    },
  ],
  footer: [
    "Footer",
    {
      nameAlign: [
        "Footer name alignment",
        { original: "Theme default", ...align },
      ],
      messageAlign: [
        "Footer message alignment",
        { original: "Theme default", ...align },
      ],
      categoryAlign: [
        "Footer category alignment",
        { center: "Center", left: "Left", right: "Right" },
      ],
      socialAlign: [
        "Social icon alignment",
        { center: "Center", left: "Left", right: "Right" },
      ],
    },
  ],
};
export function readDesign(raw) {
  let data;
  try {
    data = JSON.parse(raw || "{}");
  } catch {
    data = {};
  }
  const output = {};
  for (const [, fields] of Object.values(designGroups)) {
    for (const [key, [, choices]] of Object.entries(fields)) {
      const v = data?.[key];
      output[key] =
        typeof v === "string" && Object.hasOwn(choices, v)
          ? v
          : Object.keys(choices)[0];
    }
  }
  output.blocks = {};
  for (const [id, block] of Object.entries(data?.blocks || {})) {
    if (
      !/^block-[a-z0-9-]{1,80}$/.test(id) ||
      !block ||
      typeof block !== "object"
    )
      continue;
    output.blocks[id] = {
      title: typeof block.title === "string" ? block.title : "",
      text: typeof block.text === "string" ? block.text : "",
      image:
        typeof block.image === "string" && /^https:\/\//i.test(block.image)
          ? block.image
          : "",
      layout: block.layout === "horizontal" ? "horizontal" : "vertical",
      align: Object.hasOwn(align, block.align) ? block.align : "left",
      visible: block.visible !== false,
    };
  }
  const order = Array.isArray(data?.order) ? data.order : [];
  output.order = [
    ...new Set([
      ...order.filter(
        (k) =>
          typeof k === "string" &&
          (Object.hasOwn(sectionNames, k) || Object.hasOwn(output.blocks, k)),
      ),
      ...Object.keys(sectionNames),
      ...Object.keys(output.blocks),
    ]),
  ];
  return output;
}
