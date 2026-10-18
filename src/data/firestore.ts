import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react'
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { firestore } from './firebase'

export type FirestoreSetter<T> = (action: SetStateAction<T[]>) => void

const EMPTY_RECORDS: never[] = []

export function useFirestoreCollection<T extends { id: string }>(
  collectionName: string,
  enabled: boolean,
  seed: T[] = EMPTY_RECORDS,
): [T[], FirestoreSetter<T>, boolean] {
  const [records, setRecords] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const recordsRef = useRef(records)

  useEffect(() => {
    const database = firestore
    if (!database || !enabled) return

    return onSnapshot(collection(database, collectionName), (snapshot) => {
      const next = snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as T)
      const existingIds = new Set(next.map((record) => record.id))
      const missingRecords = snapshot.metadata.fromCache
        ? []
        : seed.filter((record) => !existingIds.has(record.id))
      if (missingRecords.length) {
        next.push(...missingRecords)
        Promise.all(missingRecords.map((record) => setDoc(doc(database, collectionName, record.id), record)))
          .catch((error: unknown) => reportCloudError(`Could not initialize ${collectionName}.`, error))
      }
      recordsRef.current = next
      setRecords(next)
      setLoading(false)
    }, (error) => {
      reportCloudError(`Could not load ${collectionName}.`, error)
      setLoading(false)
    })
  }, [collectionName, enabled, seed])

  const updateRecords = useCallback<FirestoreSetter<T>>((action) => {
    const database = firestore
    if (!database || !enabled) {
      reportCloudError('Firebase is not ready. Your changes were not saved.')
      return
    }

    const previous = recordsRef.current
    const next = typeof action === 'function' ? action(previous) : action
    recordsRef.current = next
    setRecords(next)

    const previousById = new Map(previous.map((record) => [record.id, record]))
    const nextById = new Map(next.map((record) => [record.id, record]))
    const writes = [
      ...next.filter((record) => JSON.stringify(previousById.get(record.id)) !== JSON.stringify(record))
        .map((record) => setDoc(doc(database, collectionName, record.id), record)),
      ...previous.filter((record) => !nextById.has(record.id))
        .map((record) => deleteDoc(doc(database, collectionName, record.id))),
    ]

    Promise.all(writes).catch((error: unknown) => {
      reportCloudError(`Could not save changes to ${collectionName}.`, error)
    })
  }, [collectionName, enabled])

  return [records, updateRecords, loading]
}

function reportCloudError(message: string, error?: unknown) {
  console.error(message, error)
  window.dispatchEvent(new CustomEvent('dms-cloud-error', { detail: error instanceof Error ? `${message} ${error.message}` : message }))
}
