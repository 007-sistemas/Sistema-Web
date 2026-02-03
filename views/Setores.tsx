
import React, { useState, useEffect } from 'react';
import { apiGet, apiPost, apiDelete, apiPut } from '../services/api';
import { Edit2, Trash2, Save, X } from 'lucide-react';
interface Setor { id: string; nome: string; }

const SETORES_KEY = 'biohealth_setores';

// Fallback localStorage functions
const getSetoresLocal = (): Setor[] => {
  const data = localStorage.getItem(SETORES_KEY);
  if (!data) return [];
  // Convert old format (id: number) to new format (id: string)
  const parsed = JSON.parse(data);
  return parsed.map((s: any) => ({ id: String(s.id), nome: s.nome }));
};

const saveSetorLocal = (setor: Setor) => {
  const setores = getSetoresLocal();
  setores.push(setor);
  localStorage.setItem(SETORES_KEY, JSON.stringify(setores));
};

export const SetoresView: React.FC = () => {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [novoNome, setNovoNome] = useState('');
  const [loading, setLoading] = useState(false);
  const [useLocal, setUseLocal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNome, setEditingNome] = useState('');

  useEffect(() => {
    loadSetores();
  }, []);

  const loadSetores = async () => {
    try {
      setLoading(true);
      const data = await apiGet<Setor[]>('setores');
      setSetores(data);
      setUseLocal(false);
    } catch (err) {
      console.warn('API indisponível, usando localStorage:', err);
      setSetores(getSetoresLocal());
      setUseLocal(true);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSetor = async () => {
    if (!novoNome.trim()) return;
    try {
      setLoading(true);
      
      if (useLocal) {
        // Fallback: usar localStorage com ID numérico
        const maxId = Math.max(...setores.map(s => s.id), 0);
        const novoSetor = { id: maxId + 1, nome: novoNome.trim() };
        saveSetorLocal(novoSetor);
        setSetores(getSetoresLocal());
      } else {
        // API: POST só com o nome, backend gera o ID
        const novoSetor = await apiPost<Setor>('setores', { nome: novoNome.trim() });
        setSetores([...setores, novoSetor]);
      }
      
      setNovoNome('');
    } catch (err) {
      console.error('Erro ao criar setor:', err);
      alert('Erro ao criar setor');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (setor: Setor) => {
    setEditingId(setor.id);
    setEditingNome(setor.nome);
  };

  const handleSaveEdit = async (setorId: number) => {
    if (!editingNome.trim()) return;
    try {
      setLoading(true);
      if (!useLocal) {
        // Atualizar via API
        try {
          await apiPut('setores', { id: setorId, nome: editingNome.trim() });
          await loadSetores();
        } catch (apiErr) {
          console.warn('API falhou, atualizando localmente:', apiErr);
          const updated = setores.map(s => s.id === setorId ? { ...s, nome: editingNome.trim() } : s);
          setSetores(updated);
          localStorage.setItem(SETORES_KEY, JSON.stringify(updated));
          setUseLocal(true);
        }
      } else {
        // Atualizar localmente
        const updated = setores.map(s => s.id === setorId ? { ...s, nome: editingNome.trim() } : s);
        setSetores(updated);
        localStorage.setItem(SETORES_KEY, JSON.stringify(updated));
      }
      setEditingId(null);
      setEditingNome('');
    } catch (err) {
      console.error('Erro ao editar setor:', err);
      alert('Erro ao editar setor');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingNome('');
  };

  const handleDelete = async (setorId: number) => {
    if (!confirm('Tem certeza que deseja excluir este setor?')) return;
    try {
      setLoading(true);
      if (!useLocal) {
        // Deletar via API
        try {
          await apiDelete('setores', { id: setorId });
          await loadSetores();
        } catch (apiErr) {
          console.warn('API falhou, deletando localmente:', apiErr);
          const updated = setores.filter(s => s.id !== setorId);
          setSetores(updated);
          localStorage.setItem(SETORES_KEY, JSON.stringify(updated));
          setUseLocal(true);
        }
      } else {
        // Deletar localmente
        const updated = setores.filter(s => s.id !== setorId);
        setSetores(updated);
        localStorage.setItem(SETORES_KEY, JSON.stringify(updated));
      }
    } catch (err) {
      console.error('Erro ao excluir setor:', err);
      alert('Erro ao excluir setor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Setores</h2>
      {useLocal && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
          ⚠️ API indisponível. Usando armazenamento local (dados não persistem no Neon).
        </div>
      )}
      <div className="flex gap-2 mb-6">
        <input
          className="border rounded px-3 py-2 flex-1"
          placeholder="Nome do setor"
          value={novoNome}
          onChange={e => setNovoNome(e.target.value)}
          onKeyDown={e => { if(e.key === 'Enter') handleAddSetor(); }}
          disabled={loading}
        />
        <button
          className="bg-green-600 text-white px-4 py-2 rounded font-semibold disabled:opacity-50"
          onClick={handleAddSetor}
          disabled={loading}
        >
          {loading ? 'Salvando...' : 'Novo Setor'}
        </button>
      </div>
      {loading && setores.length === 0 ? (
        <p className="text-gray-500 text-center">Carregando setores...</p>
      ) : (
        <ul className="space-y-2">
          {setores.map((setor, index) => (
            <li key={setor.id} className="flex items-center gap-4 p-3 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <span className="font-mono bg-primary-100 text-primary-700 px-3 py-1 rounded-lg text-sm font-semibold min-w-[40px] text-center">
                {index + 1}
              </span>
              
              {editingId === setor.id ? (
                <>
                  <input
                    className="border border-primary-300 rounded px-3 py-1 flex-1 focus:ring-2 focus:ring-primary-500 outline-none"
                    value={editingNome}
                    onChange={e => setEditingNome(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveEdit(setor.id);
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                    autoFocus
                  />
                  <button
                    onClick={() => handleSaveEdit(setor.id)}
                    className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors"
                    title="Salvar"
                  >
                    <Save className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    title="Cancelar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <span className="font-medium text-gray-800 flex-1">{setor.nome}</span>
                  <button
                    onClick={() => handleEdit(setor)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Editar"
                    disabled={loading}
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(setor.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Excluir"
                    disabled={loading}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </li>
          ))}
          {setores.length === 0 && !loading && (
            <li className="text-gray-400 text-center py-6">Nenhum setor cadastrado</li>
          )}
        </ul>
      )}
    </div>
  );
};
