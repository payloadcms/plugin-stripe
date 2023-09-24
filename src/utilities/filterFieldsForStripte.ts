import { type FieldSyncConfig, FieldSyncToStripeValues } from '../types'

const fieldsToSync: string[] = [...FieldSyncToStripeValues]

export const filterFieldsForStripe = (fields: FieldSyncConfig[]): FieldSyncConfig[] =>
  fields.filter(
    field => field.syncDirection === undefined || fieldsToSync.includes(field.syncDirection),
  )
