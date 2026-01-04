
import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../services/api';
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
      const id = crypto.randomUUID();
      const novoSetor = { id, nome: novoNome.trim() };
      
      if (useLocal) {
        // Fallback: usar localStorage
        saveSetorLocal(novoSetor);
        setSetores(getSetoresLocal());
      } else {
        // Tentar API
        try {
          await apiPost('setores', novoSetor);
          await loadSetores();
        } catch (apiErr) {
          console.warn('API falhou, salvando localmente:', apiErr);
          saveSetorLocal(novoSetor);
          setSetores(getSetoresLocal());
          setUseLocal(true);
        }
      }
      setNovoNome('');
    } catch (err) {
      console.error('Erro ao criar setor:', err);
      alert('Erro ao criar setor');
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
          {setores.map(setor => (
            <li key={setor.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded border">
              <span className="font-mono bg-gray-200 px-2 py-1 rounded text-xs">{setor.id}</span>
              <span className="font-medium">{setor.nome}</span>
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
