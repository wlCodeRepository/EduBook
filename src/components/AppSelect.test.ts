// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import AppSelect from "./AppSelect.vue";
describe("shared selector", () => {
  const props = {
    modelValue: "UTC",
    label: "Timezone",
    options: [
      { value: "UTC", label: "UTC" },
      { value: "Asia/Shanghai", label: "Asia/Shanghai" },
    ],
  };
  it("opens and chooses an option with the keyboard, and Escape dismisses it", async () => {
    const wrapper = mount(AppSelect, { props });
    await wrapper.get("button").trigger("keydown", { key: "ArrowDown" });
    await wrapper.get("button").trigger("keydown", { key: "ArrowDown" });
    await wrapper.get("button").trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("update:modelValue")).toEqual([["Asia/Shanghai"]]);
    expect(wrapper.find("[role=listbox]").exists()).toBe(false);
    await wrapper.get("button").trigger("click");
    await wrapper.get("button").trigger("keydown", { key: "Escape" });
    expect(wrapper.get("button").attributes("aria-expanded")).toBe("false");
    wrapper.unmount();
  });
  it("filters timezones and reports an empty search without changing the selection", async () => {
    const wrapper = mount(AppSelect, {
      props: { ...props, searchable: true, emptyLabel: "No matches" },
    });
    await wrapper.get("button").trigger("click");
    await wrapper.get("input").setValue("shanghai");
    expect(wrapper.findAll("[role=option]")).toHaveLength(1);
    await wrapper.get("input").setValue("missing");
    expect(wrapper.text()).toContain("No matches");
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
    wrapper.unmount();
  });
});
