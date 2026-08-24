'use client'

// Inspired by react-hot-toast library
import * as React from 'react'

import type { ToastActionElement, ToastProps } from '@/components/ui/toast'
import { getPreferences } from '@/lib/preferences'

/**
 * How many toasts are on screen at once.
 *
 * This was 1, which meant a batch of related feedback — "3 files rejected" —
 * could only ever show its last line, and any toast raised while another was
 * visible silently replaced it. Three is enough to stack a short burst without
 * the corner becoming a wall.
 */
const TOAST_LIMIT = 3

/**
 * How long a dismissed toast lingers in state before being dropped.
 *
 * This was 1_000_000ms — over sixteen minutes. Radix closes a toast on its own
 * `duration`, so every toast the user had ever seen stayed in the array long
 * after leaving the screen, occupying one of the slots above. It only needs to
 * outlast the exit animation.
 */
const TOAST_REMOVE_DELAY = 400

/** Default time on screen. Long enough to read two lines, short enough to ignore. */
export const TOAST_DURATION = 5000

/** Errors stay up longer: they usually need acting on, not just noticing. */
export const TOAST_DURATION_LONG = 9000

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

const actionTypes = {
  ADD_TOAST: 'ADD_TOAST',
  UPDATE_TOAST: 'UPDATE_TOAST',
  DISMISS_TOAST: 'DISMISS_TOAST',
  REMOVE_TOAST: 'REMOVE_TOAST',
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type ActionType = typeof actionTypes

type Action =
  | {
      type: ActionType['ADD_TOAST']
      toast: ToasterToast
    }
  | {
      type: ActionType['UPDATE_TOAST']
      toast: Partial<ToasterToast>
    }
  | {
      type: ActionType['DISMISS_TOAST']
      toastId?: ToasterToast['id']
    }
  | {
      type: ActionType['REMOVE_TOAST']
      toastId?: ToasterToast['id']
    }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: 'REMOVE_TOAST',
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'ADD_TOAST':
      // Newest first, and the oldest falls off the end once the stack is full.
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case 'UPDATE_TOAST':
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t,
        ),
      }

    case 'DISMISS_TOAST': {
      const { toastId } = action

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t,
        ),
      }
    }
    case 'REMOVE_TOAST':
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

type Toast = Omit<ToasterToast, 'id'>

/**
 * Raise a toast.
 *
 * Callable outside React — `lib/download.ts` and the activity bridge both use
 * it from plain functions — because the store lives at module scope.
 */
function toast({ ...props }: Toast) {
  /*
   * Settings → "In-app notifications" is honoured here, at the one place every
   * toast passes through, rather than at each of the thirty call sites.
   *
   * Errors are never suppressed. The preference is about whether routine
   * confirmations are wanted — "export ready", "signed in" — not about hiding
   * the fact that something failed, which would leave a silently broken app.
   */
  if (props.variant !== 'destructive' && !getPreferences().inAppNotifications) {
    return { id: '', dismiss: () => {}, update: () => {} }
  }

  const id = genId()

  const update = (props: Partial<ToasterToast>) =>
    dispatch({
      type: 'UPDATE_TOAST',
      toast: { ...props, id },
    })
  const dismiss = () => dispatch({ type: 'DISMISS_TOAST', toastId: id })

  dispatch({
    type: 'ADD_TOAST',
    toast: {
      // Errors get the longer dwell unless the caller says otherwise.
      duration:
        props.variant === 'destructive' ? TOAST_DURATION_LONG : TOAST_DURATION,
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  return {
    id: id,
    dismiss,
    update,
  }
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: 'DISMISS_TOAST', toastId }),
  }
}

export { useToast, toast }
