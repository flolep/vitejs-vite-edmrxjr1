import React, { useState } from 'react';
import {
  cleanupOldSessions,
  cleanupSessionData,
  deleteAllSessions,
  getSessionsReport
} from '../../utils/firebaseCleanup';

/**
 * Composant de nettoyage Firebase pour Master
 * Permet de supprimer les anciennes sessions et données obsolètes
 */
export default function FirebaseCleanup({ sessionId, onClose }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleGetReport = async () => {
    setLoading(true);
    setResult(null);
    try {
      const data = await getSessionsReport();
      setReport(data);
      setResult({ type: 'success', message: 'Rapport généré avec succès' });
    } catch (error) {
      setResult({ type: 'error', message: `Erreur: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleCleanupOldSessions = async (hours) => {
    if (!confirm(`Voulez-vous vraiment supprimer les sessions de plus de ${hours}h ?`)) {
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const { deleted, kept, errors } = await cleanupOldSessions(hours);
      setResult({
        type: 'success',
        message: `✅ ${deleted} session(s) supprimée(s), ${kept} conservée(s)`,
        details: errors.length > 0 ? `Erreurs: ${errors.join(', ')}` : null
      });
      // Rafraîchir le rapport
      await handleGetReport();
    } catch (error) {
      setResult({ type: 'error', message: `Erreur: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleCleanupCurrentSession = async () => {
    if (!sessionId) {
      setResult({ type: 'error', message: 'Aucune session active' });
      return;
    }

    if (!confirm(`Nettoyer les données obsolètes de la session ${sessionId} ?`)) {
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const { cleaned, errors } = await cleanupSessionData(sessionId);
      setResult({
        type: 'success',
        message: `✅ ${cleaned.length} élément(s) nettoyé(s)`,
        details: cleaned.length > 0 ? `Supprimés: ${cleaned.join(', ')}` : 'Aucune donnée obsolète trouvée'
      });
    } catch (error) {
      setResult({ type: 'error', message: `Erreur: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAllSessions = async () => {
    if (!confirm('⚠️ ATTENTION: Supprimer TOUTES les sessions ? Cette action est irréversible!')) {
      return;
    }

    if (!confirm('Êtes-vous VRAIMENT sûr ? Toutes les données seront perdues!')) {
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const { success, error } = await deleteAllSessions();
      if (success) {
        setResult({ type: 'success', message: '✅ Toutes les sessions ont été supprimées' });
        setReport(null);
      } else {
        setResult({ type: 'error', message: `Erreur: ${error}` });
      }
    } catch (error) {
      setResult({ type: 'error', message: `Erreur: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: '#1f2937',
        borderRadius: '1rem',
        padding: '2rem',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        color: 'white'
      }}>
        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 'bold' }}>
          🧹 Nettoyage Firebase
        </h2>

        {/* Résultat */}
        {result && (
          <div style={{
            padding: '1rem',
            borderRadius: '0.5rem',
            marginBottom: '1.5rem',
            backgroundColor: result.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            border: result.type === 'success' ? '1px solid #10b981' : '1px solid #ef4444'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
              {result.message}
            </div>
            {result.details && (
              <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>
                {result.details}
              </div>
            )}
          </div>
        )}

        {/* Rapport */}
        <div style={{ marginBottom: '1.5rem' }}>
          <button
            onClick={handleGetReport}
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: 'rgba(59, 130, 246, 0.3)',
              border: '1px solid #3b82f6',
              borderRadius: '0.5rem',
              color: 'white',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: '1rem'
            }}
          >
            📊 Générer rapport des sessions
          </button>

          {report && (
            <div style={{
              padding: '1rem',
              backgroundColor: 'rgba(55, 65, 81, 0.5)',
              borderRadius: '0.5rem',
              fontSize: '0.875rem'
            }}>
              <div><strong>Total:</strong> {report.total} session(s)</div>
              <div><strong>Actives:</strong> {report.active} | <strong>Inactives:</strong> {report.inactive}</div>
              <div><strong>Mode Équipe:</strong> {report.teamMode} | <strong>Mode Quiz:</strong> {report.quizMode}</div>

              {report.details.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <strong>Détails:</strong>
                  <div style={{ maxHeight: '150px', overflowY: 'auto', marginTop: '0.5rem' }}>
                    {report.details.map((detail, idx) => (
                      <div key={idx} style={{
                        padding: '0.5rem',
                        marginBottom: '0.25rem',
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: '0.25rem',
                        fontSize: '0.75rem'
                      }}>
                        <div><strong>{detail.sessionId}</strong></div>
                        <div>
                          {detail.active ? '🟢 Active' : '🔴 Inactive'} |
                          {detail.mode === 'quiz' ? ' 🎯 Quiz' : ' 👥 Équipe'} |
                          {detail.lastActivityMinutes ? ` ⏱️ ${detail.lastActivityMinutes}min` : ' ⏱️ N/A'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions de nettoyage */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <button
            onClick={() => handleCleanupOldSessions(24)}
            disabled={loading}
            style={{
              padding: '0.75rem',
              backgroundColor: 'rgba(251, 191, 36, 0.3)',
              border: '1px solid #fbbf24',
              borderRadius: '0.5rem',
              color: 'white',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            🗑️ Supprimer sessions &gt; 24h
          </button>

          <button
            onClick={() => handleCleanupOldSessions(1)}
            disabled={loading}
            style={{
              padding: '0.75rem',
              backgroundColor: 'rgba(251, 191, 36, 0.3)',
              border: '1px solid #fbbf24',
              borderRadius: '0.5rem',
              color: 'white',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            🗑️ Supprimer sessions &gt; 1h
          </button>

          <button
            onClick={handleCleanupCurrentSession}
            disabled={loading || !sessionId}
            style={{
              padding: '0.75rem',
              backgroundColor: 'rgba(139, 92, 246, 0.3)',
              border: '1px solid #8b5cf6',
              borderRadius: '0.5rem',
              color: 'white',
              cursor: loading || !sessionId ? 'not-allowed' : 'pointer'
            }}
          >
            🧹 Nettoyer session actuelle
          </button>

          <button
            onClick={handleDeleteAllSessions}
            disabled={loading}
            style={{
              padding: '0.75rem',
              backgroundColor: 'rgba(239, 68, 68, 0.3)',
              border: '1px solid #ef4444',
              borderRadius: '0.5rem',
              color: 'white',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            ⚠️ SUPPRIMER TOUTES LES SESSIONS
          </button>
        </div>

        {/* Bouton fermer */}
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: 'rgba(156, 163, 175, 0.3)',
            border: '1px solid #9ca3af',
            borderRadius: '0.5rem',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          Fermer
        </button>
      </div>
    </div>
  );
}
