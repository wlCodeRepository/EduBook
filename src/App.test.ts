import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import App from './App.vue'

describe('EduBook booking workspace', () => {
  it('renders a safe setup screen when public Supabase config is absent', () => {
    const wrapper = mount(App)
    expect(wrapper.text()).toContain('EduBook')
    expect(wrapper.text()).toContain('Supabase is not configured')
    expect(wrapper.find('input[type="email"]').exists()).toBe(true)
  })

  it('offers a Chinese language switch and keeps timezone as a select', async () => {
    const wrapper = mount(App)
    await wrapper.get('.language-button').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.get('.auth-switch').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('已自动识别时区，可修改')
    expect(wrapper.find('select').exists()).toBe(true)
  })

  it('uses password login and exposes forgot-password recovery', () => {
    const wrapper = mount(App)
    expect(wrapper.text()).toMatch(/登录|Sign in/)
    expect(wrapper.text()).toMatch(/忘记密码|Forgot your password/)
    expect(wrapper.find('input[type="password"]').exists()).toBe(true)
  })

  it('opens a dedicated password recovery view', async () => {
    const wrapper = mount(App)
    await wrapper.get('.forgot-link').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toMatch(/重置.*密码|Reset.*password/)
    expect(wrapper.find('input[type="email"]').exists()).toBe(true)
  })
})
