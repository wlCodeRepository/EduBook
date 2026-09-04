import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PasswordSettings from "./PasswordSettings.vue";
const { updateUser } = vi.hoisted(() => ({ updateUser: vi.fn() }));
vi.mock("../lib/supabase", () => ({ supabase: { auth: { updateUser } } }));
describe("personal password changes", () => {
  beforeEach(() => updateUser.mockReset());
  it("does not send mismatched passwords", async () => {
    const view = mount(PasswordSettings, { props: { language: "en" } });
    await view.findAll("input")[0].setValue("example-password");
    await view.findAll("input")[1].setValue("different-password");
    await view.get("form").trigger("submit");
    expect(updateUser).not.toHaveBeenCalled();
    expect(view.text()).toContain("Passwords do not match");
    view.unmount();
  });
  it("clears secrets only after a successful update and displays failures without claiming success", async () => {
    const view = mount(PasswordSettings, { props: { language: "en" } });
    for (const input of view.findAll("input"))
      await input.setValue("example-password");
    updateUser.mockResolvedValueOnce({ error: new Error("offline") });
    await view.get("form").trigger("submit");
    await flushPromises();
    expect(view.text()).toContain("Password was not changed");
    expect(view.findAll("input")[0].element.value).toBe("example-password");
    updateUser.mockResolvedValueOnce({ error: null });
    await view.get("form").trigger("submit");
    await flushPromises();
    expect(view.text()).toContain("Password changed.");
    expect(
      view.findAll("input").every((input) => input.element.value === ""),
    ).toBe(true);
    view.unmount();
  });
});
