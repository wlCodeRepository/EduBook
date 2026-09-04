import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AccountCenter from "./AccountCenter.vue";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../lib/supabase", () => ({
  supabase: { rpc, auth: { updateUser: vi.fn() } },
}));
const profile = {
  id: "u",
  username: "alex",
  display_name: "Alex",
  role: "TEACHER" as const,
  email: "",
  timezone: "UTC",
  default_lesson_minutes: 60,
};
const props = {
  profile,
  section: "profile" as const,
  language: "en",
  zones: [{ value: "UTC", label: "UTC" }],
};
describe("account dialog", () => {
  beforeEach(() => {
    rpc.mockReset();
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();
    document.body.style.overflow = "";
  });
  it("updates profile without sending username or role and reports failed saves in place", async () => {
    const view = mount(AccountCenter, { props });
    expect(view.text()).toContain("Username and role are fixed");
    await view.get("input[autocomplete=name]").setValue("Alex Chen");
    rpc.mockResolvedValueOnce({ error: new Error("offline"), data: null });
    await view.get("form").trigger("submit");
    await flushPromises();
    expect(view.text()).toContain("Could not save");
    expect(view.emitted("close")).toBeUndefined();
    rpc.mockResolvedValueOnce({
      error: null,
      data: { ...profile, display_name: "Alex Chen" },
    });
    await view.get("form").trigger("submit");
    await flushPromises();
    expect(rpc).toHaveBeenLastCalledWith("update_my_profile", {
      p_display_name: "Alex Chen",
      p_timezone: "UTC",
      p_default_lesson_minutes: 60,
    });
    expect(view.emitted("updated")).toHaveLength(1);
    expect(view.text()).toContain("Profile saved");
    view.unmount();
    expect(document.body.style.overflow).toBe("");
  });
  it("opens directly on password settings and closes on Escape cancel", async () => {
    const view = mount(AccountCenter, {
      props: { ...props, section: "password" },
    });
    expect(view.findAll("input[type=password]")).toHaveLength(2);
    await view.get("dialog").trigger("cancel");
    expect(view.emitted("close")).toHaveLength(1);
    view.unmount();
  });
});
