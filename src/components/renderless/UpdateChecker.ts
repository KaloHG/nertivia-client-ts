import { AppUpdateModule } from "@/store/modules/appUpdate";
import { PopoutsModule } from "@/store/modules/popouts";
import WindowProperties from "@/utils/windowProperties";
import Vue from "vue";
import { defineComponent } from "vue";
export default defineComponent({
  name: "UpdateChecker",
  data() {
    return {
      lastUpdateChecked: Date.now(),
      updateAvailable: false,
      checkAfter: 600000
    };
  },
  render(h) {
    return h("template");
  },
  computed: {
    focused(): any {
      return WindowProperties.isFocused;
    }
  },
  watch: {
    focused: {
      handler: "onFocusChange"
    }
  },
  mounted() {
    this.showChangelog();
  },
  methods: {
    showChangelog() {
      const seenVersion = localStorage["changelogSeenVersion"];
      if (!seenVersion) {
        localStorage["changelogSeenVersion"] = this.$version;
        return;
      }
      if (seenVersion === this.$version) return;
      localStorage["changelogSeenVersion"] = this.$version;
      PopoutsModule.ShowPopout({
        id: "changelog-popout",
        component: "ChangelogPopout"
      });
    },
    onFocusChange() {
      AppUpdateModule.check();
    }
  }
});
