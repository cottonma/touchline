import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { oppositionNotesApi, type CreateOppositionNoteInput } from '@/services/opposition-notes.service';

/**
 * React Query hooks for opposition notes.
 */

const OPPOSITION_NOTES_KEY = ['opposition-notes'] as const;

/** Fetch all opposition notes for a given opponent name */
export function useOppositionNotes(opponent: string | undefined) {
  return useQuery({
    queryKey: [...OPPOSITION_NOTES_KEY, opponent],
    queryFn: () => oppositionNotesApi.getByOpponent(opponent!),
    select: (response) => response.data,
    enabled: !!opponent,
  });
}

/** Save new opposition notes */
export function useCreateOppositionNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateOppositionNoteInput) => oppositionNotesApi.create(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...OPPOSITION_NOTES_KEY, variables.opponent] });
    },
  });
}
