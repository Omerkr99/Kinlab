import { DataRecorder } from './DataRecorder'

test('no record when stopped', () => {
  const r = new DataRecorder()
  r.record(0.016, 1, 2, 3, 4, 5, 6)
  expect(r.getLength()).toBe(0)
})

test('records when started', () => {
  const r = new DataRecorder()
  r.start()
  r.record(0.016, 10, 20, 5, -3, 9.8, 9.8)
  expect(r.getLength()).toBe(1)
  expect(r.getSeries('x')[0]).toBe(10)
  expect(r.getSeries('y')[0]).toBe(20)
})

test('reset clears all data', () => {
  const r = new DataRecorder()
  r.start()
  r.record(0.016, 10, 20, 5, -3, 9.8, 9.8)
  r.reset()
  expect(r.getLength()).toBe(0)
})

test('getSeries returns correct values for all 7 keys', () => {
  const r = new DataRecorder()
  r.start()
  r.record(0.016, 100, 200, 20, -10, 9.8, 9.8)
  r.record(0.032, 102, 210, 21, -9,  9.8, 9.8)
  expect(r.getSeries('x')).toEqual([100, 102])
  expect(r.getSeries('y')).toEqual([200, 210])
  expect(r.getSeries('vy')).toEqual([-10, -9])
  expect(r.getSeries('ay')).toEqual([9.8, 9.8])
})

test('all 7 series have equal length', () => {
  const r = new DataRecorder()
  r.start()
  for (let i = 0; i < 50; i++) r.record(i * 0.016, i, i * 2, i * 0.5, i * -0.3, 9.8, 9.8)
  const len = r.getLength()
  expect(r.getSeries('time').length).toBe(len)
  expect(r.getSeries('y').length).toBe(len)
  expect(r.getSeries('vy').length).toBe(len)
  expect(r.getSeries('ay').length).toBe(len)
})
