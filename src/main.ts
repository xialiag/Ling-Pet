import { createPlugin } from "@tauri-store/pinia";
import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import '@mdi/font/css/materialdesignicons.css' // Material Design Icons 样式

const vuetify = createVuetify({
  components,
  directives,
  icons: {
    // 确保默认图标集设置为 'mdi'
    defaultSet: 'mdi',
  },
})


// 创建Vue应用实例，注册路由器并挂载到DOM元素
const app = createApp(App);
app.use(router);
const pinia = createPinia();
app.use(pinia);
pinia.use(createPlugin());
app.use(vuetify);

// 初始化插件系统
import { initializePluginSystem } from '../pluginLoader/init'
initializePluginSystem(app, router).then(() => {
  console.log('[Main] 插件系统已就绪')
})

app.mount("#app");
