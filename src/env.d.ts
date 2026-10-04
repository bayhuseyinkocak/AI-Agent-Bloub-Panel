declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

declare module '@/packs/demo-avatars.json' {
  import type { AgentPack } from '@/pack/types'
  const pack: AgentPack
  export default pack
}
