import { describe, expect, it } from 'vitest'
import { pickNeighbour, type Box } from './gamepadNav'

const grid: Box[] = [
  { x: 0, y: 0, w: 100, h: 40 },
  { x: 120, y: 0, w: 100, h: 40 },
  { x: 0, y: 60, w: 100, h: 40 },
  { x: 120, y: 60, w: 100, h: 40 },
]

describe('spatial gamepad navigation', () => {
  it('moves across a 2x2 grid', () => {
    expect(pickNeighbour(grid, 0, 'right')).toBe(1)
    expect(pickNeighbour(grid, 0, 'down')).toBe(2)
    expect(pickNeighbour(grid, 3, 'left')).toBe(2)
    expect(pickNeighbour(grid, 3, 'up')).toBe(1)
  })
  it('returns -1 at an edge', () => {
    expect(pickNeighbour(grid, 0, 'up')).toBe(-1)
    expect(pickNeighbour(grid, 1, 'right')).toBe(-1)
  })
})
