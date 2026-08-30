import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import App from './App.vue'

describe('EduBook booking workspace', () => {
  it('renders a safe setup screen when public Supabase config is absent', () => {
    const wrapper = mount(App)
    expect(wrapper.text()).toContain('EduBook')
    expect(wrapper.text()).toContain('还没有配置 Supabase 公共环境变量')
    expect(wrapper.find('input[type="password"]').exists()).toBe(true)
  })
})
