import { DataRecorder } from './DataRecorder'

test('no record when stopped', () => {
  const r = new DataRecorder()
  r.record(0.016, 1, 2, 3)
  expect(r.getLength()).toBe(0)
})

test('records when started', () => {
  const r = new DataRecorder()
  r.start()
  r.record(0.016, 10, 5, 9.8)
  expect(r.getLength()).toBe(1)
  expect(r.getSeries('x')[0]).toBe(10)
})

test('reset clears all data', () => {
  const r = new DataRecorder()
  r.start()
  r.record(0.016, 10, 5, 9.8)
  r.reset()
  expect(r.getLength()).toBe(0)
})

test('getSeries returns correct values', () => {
  const r = new DataRecorder()
  r.start()
  r.record(0.016, 100, 20, 9.8)
  r.record(0.032, 102, 21, 9.8)
  expect(r.getSeries('x')).toEqual([100, 102])
})

test('all series have equal length', () => {
  const r = new DataRecorder()
  r.start()
  for (let i = 0; i < 50; i++) r.record(i * 0.016, i, i * 0.5, 9.8)
  expect(r.getSeries('time').length).toBe(r.getSeries('x').length)
})
