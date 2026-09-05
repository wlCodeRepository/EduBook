// Isolated visual fixture; production builds use src/main.ts only.
import { createApp } from "vue";
import WorkspacePreview from "./WorkspacePreview.vue";
import "../../src/styles.css";
createApp(WorkspacePreview).mount("#app");
