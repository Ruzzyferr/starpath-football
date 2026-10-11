import { expect, it } from 'vitest'
import { FEEL_KINDS } from './feelHarness'
import { KIND_CHECK_GROUPS, kindChecksSuite } from './kindChecks.testkit'

it('the four groups cover every moment kind once', () => {
  expect([...KIND_CHECK_GROUPS.flat()].sort()).toEqual([...FEEL_KINDS].sort())
})

kindChecksSuite(0)
