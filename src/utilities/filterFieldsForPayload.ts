import { type FieldSyncConfig, FieldSyncToPayloadValues } from '../types'

const fieldsToSync: string[] = [...FieldSyncToPayloadValues]

export const filterFieldsForPayload = (fields: FieldSyncConfig[]): FieldSyncConfig[] =>
  fields.filter(
    field => field.syncDirection === undefined || fieldsToSync.includes(field.syncDirection),
  )
