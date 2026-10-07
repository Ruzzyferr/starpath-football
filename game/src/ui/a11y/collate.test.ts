import { describe, expect, it } from 'vitest'
import { compareText } from './collate'

describe('Turkish collation', () => {
  it('orders dotless i before i and ç/ş/ö after their base letters', () => {
    const names = ['İpek', 'Ilgaz', 'Çağla', 'Cem', 'Şule', 'Selim', 'Ömer', 'Orhan']
    expect([...names].sort((a, b) => compareText(a, b, 'tr'))).toEqual(['Cem', 'Çağla', 'Ilgaz', 'İpek', 'Orhan', 'Ömer', 'Selim', 'Şule'])
  })
})
