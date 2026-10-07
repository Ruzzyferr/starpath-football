/** Mirror of a dictionary's shape with every leaf widened to string. Used to
 *  force the English dictionary to have exactly the Turkish keys. */
export type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> }
