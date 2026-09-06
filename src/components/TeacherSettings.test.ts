import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import TeacherSettings from './TeacherSettings.vue';
const props={minutes:30,blocked:[],timezone:'UTC',language:'en',busy:false,draft:{start:'',end:'',reason:''}};
describe('focused teacher settings',()=>{
 it('opens the prefilled blackout from the calendar and returns to the list after save',async()=>{
  const w=mount(TeacherSettings,{props:{...props,draft:{start:'2026-09-10T09:00',end:'2026-09-10T10:00',reason:''}}});
  expect(w.findAll('input[type=datetime-local]')).toHaveLength(2);
  expect((w.get('input[type=datetime-local]').element as HTMLInputElement).value).toBe('2026-09-10T09:00');
  await w.setProps({draft:{start:'',end:'',reason:''}});
  expect(w.find('input[type=datetime-local]').exists()).toBe(false);
  expect(w.text()).toContain('Your blocked time');
  w.unmount();
 });
 it('shows one task and keeps lesson changes as a draft',async()=>{
  const w=mount(TeacherSettings,{props});
  expect(w.find('input[type=number]').exists()).toBe(false);
  expect(w.text()).toContain('50 min');
  expect(w.text()).toContain('10 minutes');
  expect(w.emitted('save')).toBeUndefined();
  await w.get('.settings-tabs button:nth-child(2)').trigger('click');
  expect(w.find('input[type=number]').exists()).toBe(false);
  await w.get('.settings-blocked .primary-button').trigger('click');
  expect(w.findAll('input[type=datetime-local]')).toHaveLength(2);
  w.unmount();
 });
 it('paginates blocked periods and clamps after removal',async()=>{
  const blocked=Array.from({length:4},(_,i)=>({id:String(i),teacher_id:'t',start_at_utc:'2026-09-10T10:00:00Z',end_at_utc:'2026-09-10T11:00:00Z',reason:null}));
  const w=mount(TeacherSettings,{props:{...props,blocked}});
  await w.get('.settings-tabs button:nth-child(2)').trigger('click');
  expect(w.findAll('.campus-block-row')).toHaveLength(3);
  await w.get('nav[aria-label=Pagination] button:last-child').trigger('click');
  expect(w.findAll('.campus-block-row')).toHaveLength(1);
  await w.setProps({blocked:blocked.slice(0,3)});
  expect(w.findAll('.campus-block-row')).toHaveLength(3);
  w.unmount();
 });
});
