import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import LearningRoom from "./LearningRoom.vue";
describe("learning room", () => {
  it("updates the teacher plaque and offers a keyboard-accessible perspective toggle", async () => {
    const view = mount(LearningRoom, {
      props: { language: "en", name: "Mia", minutes: 30 },
    });
    expect(view.get(".room-name").text()).toContain("Mia");
    expect(view.get(".room-name").text()).toContain("30");
    expect(view.get(".room-perspective").attributes("aria-hidden")).toBe(
      "true",
    );
    await view.get("button").trigger("click");
    expect(view.classes()).toContain("turned");
    expect(view.get("button").attributes("aria-pressed")).toBe("true");
    await view.setProps({ language: "zh", name: "陈老师" });
    expect(view.get(".room-name").text()).toContain("陈老师");
    expect(view.get("button").text()).toContain("换个视角");
    view.unmount();
  });
});
