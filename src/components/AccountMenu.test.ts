import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import AccountMenu from "./AccountMenu.vue";
describe("avatar account menu", () => {
  it("opens password settings without changing the business route", async () => {
    const view = mount(AccountMenu, {
      props: {
        displayName: "Alex",
        username: "alex",
        roleLabel: "Teacher",
        language: "en",
      },
    });
    await view.get('button[aria-haspopup="menu"]').trigger("click");
    expect(view.get("[role=menu]").text()).toContain("Personal information");
    await view.get("[data-action=password]").trigger("click");
    expect(view.emitted("open")).toEqual([["password"]]);
    expect(view.find("[role=menu]").exists()).toBe(false);
    view.unmount();
  });
  it("dismisses on Escape and outside clicks", async () => {
    const view = mount(AccountMenu, {
      props: {
        displayName: "Alex",
        username: "alex",
        roleLabel: "Teacher",
        language: "en",
      },
      attachTo: document.body,
    });
    const button = view.get('button[aria-haspopup="menu"]');
    await button.trigger("click");
    await view.get("[role=menu]").trigger("keydown", { key: "Escape" });
    expect(document.activeElement).toBe(button.element);
    await button.trigger("click");
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await view.vm.$nextTick();
    expect(view.find("[role=menu]").exists()).toBe(false);
    view.unmount();
  });
});
