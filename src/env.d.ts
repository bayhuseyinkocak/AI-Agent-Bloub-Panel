declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

declare module '@/packs/demo-avatars.json' {
  const pack: unknown
  export default pack
}

declare module '@/packs/tires-master-data.json' {
  const pack: unknown
  export default pack
}
