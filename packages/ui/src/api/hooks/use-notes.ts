import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getNote, listNotes, createNote, updateNote, deleteNote } from '../tools/notes.js';

export function useNotes(params: Parameters<typeof listNotes>[0] = {}) {
  return useQuery({
    queryKey: ['notes', params],
    queryFn: () => listNotes(params),
    refetchOnWindowFocus: true,
  });
}

export function useNote(id: string | undefined) {
  return useQuery({
    queryKey: ['notes', 'detail', id],
    queryFn: () => getNote({ id: id! }),
    enabled: !!id,
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createNote,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateNote,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['notes'] });
      qc.invalidateQueries({ queryKey: ['notes', 'detail', vars.id] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteNote,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}
