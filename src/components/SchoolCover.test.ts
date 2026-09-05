import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import SchoolCover from "./SchoolCover.vue";

describe("school cover", () => {
  it("localizes meaningful copy while keeping the brand and decorative index separate", async () => {
    const view = mount(SchoolCover, { props: { language: "en" } });
    expect(view.attributes("aria-label")).toBe("EduBook lesson booking");
    expect(view.get(".cover-title p").text()).toBe(
      "A place for your next lesson.",
    );
    expect(view.get(".cover-timetable").attributes("aria-hidden")).toBe("true");
    await view.setProps({ language: "zh" });
    expect(view.attributes("aria-label")).toBe("EduBook 课程预约");
    expect(view.get(".cover-title p").text()).toBe(
      "你的下一堂课，从这里开始。",
    );
    expect(view.get("footer").text()).toContain("跨越时区");
    view.unmount();
  });
});
