import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import App from './App.vue'

describe('EduBook booking workspace', () => {
  it('renders the student booking view and can select a slot', async () => {
    const wrapper = mount(App)
    expect(wrapper.text()).toContain('找到适合你的课堂')
    const available = wrapper.findAll('.slot-cell.available')[0]
    await available.trigger('click')
    expect(wrapper.find('.summary-details').text()).toContain('10:00')
  })

  it('switches to the teacher workspace', async () => {
    const wrapper = mount(App)
    await wrapper.get('[role="tab"]:nth-child(2)').trigger('click')
    expect(wrapper.text()).toContain('预约申请，一目了然')
    expect(wrapper.text()).toContain('固定授课时间')
  })

  it('exposes an error recovery state', async () => {
    const wrapper = mount(App)
    await wrapper.get('select').setValue('error')
    expect(wrapper.text()).toContain('排期加载失败')
    await wrapper.get('.error-state button').trigger('click')
    expect(wrapper.text()).toContain('可预约')
  })
})
