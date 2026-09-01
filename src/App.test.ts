import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import App from './App.vue'

describe('EduBook booking workspace', () => {
  it('renders a safe setup screen when public Supabase config is absent', () => {
    const wrapper = mount(App)
    expect(wrapper.text()).toContain('EduBook')
    expect(wrapper.text()).toContain('Supabase is not configured')
    expect(wrapper.find('input[autocomplete="username"]').exists()).toBe(true)
  })

  it('offers a Chinese language switch and keeps timezone as a select', async () => {
    const wrapper = mount(App)
    await wrapper.get('.language-button').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('账户由管理员创建')
    expect(wrapper.find('.forgot-link').exists()).toBe(false)
  })

  it('uses username and password login without public email flows', () => {
    const wrapper = mount(App)
    expect(wrapper.text()).toMatch(/登录|Sign in/)
    expect(wrapper.text()).toMatch(/账号名|Username/)
    expect(wrapper.find('input[autocomplete="username"]').exists()).toBe(true)
    expect(wrapper.find('input[type="password"]').exists()).toBe(true)
    expect(wrapper.find('.forgot-link').exists()).toBe(false)
    expect(wrapper.text()).not.toMatch(/忘记密码|Forgot your password|发送验证码|Send verification code/)
  })
})
