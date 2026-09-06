import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import CampusShell from './CampusShell.vue';
describe('campus navigation', () => {
  for (const [role, page, label] of [['ADMIN','people','People'],['TEACHER','requests','Requests'],['STUDENT','history','My lessons']] as const) {
    it(`includes ${role} in the same navigation and emits a destination`, async () => {
      const view = mount(CampusShell, {props:{role,active:page,language:'en',name:'Alex',username:'alex',timezone:'UTC',title:'Campus'}});
      const button=view.findAll('nav button').find(b=>b.text().includes(label))!;
      expect(button.attributes('aria-current')).toBe('page');
      await button.trigger('click'); expect(view.emitted('navigate')?.[0]).toEqual([page]);
      expect(view.find('.account-trigger').exists()).toBe(true);
      view.unmount();
    });
  }
});
