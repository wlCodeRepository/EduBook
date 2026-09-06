import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CampusDrawer from './CampusDrawer.vue';
describe('campus drawer',()=>{
 beforeEach(()=>{HTMLDialogElement.prototype.showModal=vi.fn();HTMLDialogElement.prototype.close=vi.fn();});
 it('does not dismiss a pending operation and restores scroll on unmount',async()=>{
  const view=mount(CampusDrawer,{props:{title:'New person',busy:true,language:'en'}});
  expect(document.body.style.overflow).toBe('hidden');
  await view.get('dialog').trigger('cancel'); expect(view.emitted('close')).toBeUndefined();
  await view.setProps({busy:false}); await view.get('dialog').trigger('cancel'); expect(view.emitted('close')).toHaveLength(1);
  view.unmount(); expect(document.body.style.overflow).toBe('');
 });
});
