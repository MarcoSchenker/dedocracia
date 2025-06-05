import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { PieChart, Activity, Plus, Trash2 } from 'lucide-react';

// API base URL from environment variables or fallback to localhost
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://34.197.123.11:3000';

const Dashboard = () => {
    const [candidatos, setCandidatos] = useState([]);
    const [estadisticas, setEstadisticas] = useState([]);
    const [activeSection, setActiveSection] = useState('dashboard');
    const [nuevoNombre, setNuevoNombre] = useState('');
    const [mensaje, setMensaje] = useState('');
    const [nuevaDescripcion, setNuevaDescripcion] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [votacionFinalizada, setVotacionFinalizada] = useState(false);
    const [ganador, setGanador] = useState(null);
    const [finalizandoVotacion, setFinalizandoVotacion] = useState(false);

    // Cargar datos
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                await Promise.all([
                    fetchCandidatos(),
                    fetchEstadisticas(),
                ]);
                setError(null);
            } catch (err) {
                console.error('Error cargando datos:', err);
                setError('Error de conexión con el servidor. Intente nuevamente más tarde.');
            } finally {
                setLoading(false);
            }
        };

        loadData();
        
        // Configurar actualización automática cada 30 segundos
        const intervalId = setInterval(() => {
            loadData();
        }, 30000);
        
        // Limpiar intervalo cuando el componente se desmonte
        return () => clearInterval(intervalId);
    }, []);

    // Función para obtener candidatos
    const fetchCandidatos = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/candidatos`);
            if (!response.ok) throw new Error('Error en la respuesta del servidor');
            const data = await response.json();
            setCandidatos(data);
        } catch (error) {
            console.error('Error al obtener candidatos:', error);
            throw error;
        }
    };

    // Función para obtener estadísticas
    const fetchEstadisticas = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/estadisticas`);
            if (!response.ok) throw new Error('Error en la respuesta del servidor');
            const data = await response.json();
            setEstadisticas(data);
        } catch (error) {
            console.error('Error al obtener estadísticas:', error);
            throw error;
        }
    };
    // Función para agregar candidato
    const agregarCandidato = async () => {
        if (!nuevoNombre.trim()) {
            setMensaje('El nombre del candidato es requerido');
            return;
        }

        try {
            setMensaje('');
            const response = await fetch(`${API_BASE_URL}/api/candidatos`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    nombre: nuevoNombre,
                    descripcion: nuevaDescripcion
                }),
            });

            if (response.ok) {
                setNuevoNombre('');
                setNuevaDescripcion('');
                setMensaje('Candidato agregado correctamente');
                // Refrescar la lista de candidatos
                fetchCandidatos();
                fetchEstadisticas();
            
            } else {
                const error = await response.json();
                setMensaje(`Error: ${error.error}`);
            }
        } catch (error) {
            console.error('Error al agregar candidato:', error);
            setMensaje('Error al conectar con el servidor');
        }
    };

    // Función para eliminar candidato
    const eliminarCandidato = async (id) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/candidatos/${id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setMensaje('Candidato eliminado correctamente');
                // Refrescar la lista de candidatos
                fetchCandidatos();
                fetchEstadisticas();
            } else {
                const error = await response.json();
                setMensaje(`Error: ${error.error}`);
            }
        } catch (error) {
            console.error('Error al eliminar candidato:', error);
            setMensaje('Error al conectar con el servidor');
        }
    };

    // Función para finalizar votación
    const finalizarVotacion = async () => {
        if (!window.confirm('¿Está seguro de que desea finalizar la votación? Esta acción no se puede deshacer.')) {
            return;
        }

        setFinalizandoVotacion(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/finalizar-votacion`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (response.ok) {
                const resultado = await response.json();
                setVotacionFinalizada(true);
                setGanador(resultado.ganador);
                setEstadisticas(resultado.estadisticas);
                setMensaje(`Votación finalizada. Ganador: ${resultado.ganador.nombre} con ${resultado.ganador.votos} votos`);
                console.log('🏆 Resultado de la votación:', resultado);
            } else {
                const error = await response.json();
                setMensaje(`Error al finalizar votación: ${error.error}`);
            }
        } catch (error) {
            console.error('Error al finalizar votación:', error);
            setMensaje('Error al conectar con el servidor para finalizar');
        } finally {
            setFinalizandoVotacion(false);
        }
    };

    // Comprobar si se está cargando o hay error
    if (loading && candidatos.length === 0) {
        return (
            <div className="App">
                <div className="main-container">
                    <div className="sidebar">
                        <div className="sidebar-logo">
                            <div>DeD</div>
                        </div>
                        <div className="sidebar-menu">
                            <div className="sidebar-item active">
                                <div className="sidebar-item-icon">
                                    <Activity size={24} />
                                </div>
                                <div className="sidebar-item-label">Dashboard</div>
                            </div>
                        </div>
                    </div>
                    <div className="dashboard">
                        <div className="dashboard-header">
                            <h2 className="dashboard-title">DeDoCracia</h2>
                        </div>
                        <div className="card">
                            <div className="card-title">Cargando datos...</div>
                            <div className="p-4 text-center">
                                <p>Por favor espere mientras se cargan los datos del sistema.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    
    if (error) {
        return (
            <div className="App">
                <div className="main-container">
                    <div className="sidebar">
                        <div className="sidebar-logo">
                            <div>DeD</div>
                        </div>
                        <div className="sidebar-menu">
                            <div className="sidebar-item active">
                                <div className="sidebar-item-icon">
                                    <Activity size={24} />
                                </div>
                                <div className="sidebar-item-label">Dashboard</div>
                            </div>
                        </div>
                    </div>
                    <div className="dashboard">
                        <div className="dashboard-header">
                            <h2 className="dashboard-title">DeDoCracia</h2>
                        </div>
                        <div className="card">
                            <div className="card-title">Error de conexión</div>
                            <div className="p-4 text-center">
                                <p className="message error">{error}</p>
                                <button className="btn-primary mt-4" onClick={() => window.location.reload()}>
                                    Reintentar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const renderContent = () => {
        switch (activeSection) {
            case 'dashboard':
                return (
                    <>
                        <div className="dashboard-grid">
                            {votacionFinalizada && ganador && (
                                <div className="card winner-card">
                                    <div className="card-title">🏆 GANADOR DE LA VOTACIÓN</div>
                                    <div className="winner-info">
                                        <h2 className="winner-name">{ganador.nombre}</h2>
                                        <p className="winner-votes">{ganador.votos} votos</p>
                                        <div className="winner-message">¡Felicitaciones al ganador!</div>
                                    </div>
                                </div>
                            )}
                            
                            <div className="card">
                                <div className="card-title">Información Estadística</div>
                                <div className="stats-container">
                                    <div className="stats-header">
                                        <div className="stats-title">Región Austral</div>
                                        {!votacionFinalizada && (
                                            <button 
                                                className="btn-finalizar"
                                                onClick={finalizarVotacion}
                                                disabled={finalizandoVotacion}
                                            >
                                                {finalizandoVotacion ? 'Finalizando...' : 'Finalizar Votación'}
                                            </button>
                                        )}
                                    </div>
                                    <div className="stats-chart">
                                        <ResponsiveContainer width="100%" height={300}>
                                            <BarChart data={estadisticas}>
                                                <XAxis dataKey="nombre" />
                                                <YAxis />
                                                <Tooltip />
                                                <Bar dataKey="total_votos" fill="#2052d3" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                            <div className="card">
                                <div className="card-title">Autenticación por Huella</div>
                                <div className="fingerprint-container">
                                    <div className="fingerprint-scanner">
                                        <svg className="fingerprint-icon" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                                            <g fill="none" stroke="#2052d3" strokeWidth="2">
                                                <path d="M50,15 C31.2,15 16,30.2 16,49 C16,67.8 31.2,83 50,83 C68.8,83 84,67.8 84,49 C84,30.2 68.8,15 50,15 Z" />
                                                <path d="M50,25 C36.7,25 26,35.7 26,49 C26,62.3 36.7,73 50,73 C63.3,73 74,62.3 74,49 C74,35.7 63.3,25 50,25 Z" />
                                                <path d="M50,35 C42.3,35 36,41.3 36,49 C36,56.7 42.3,63 50,63 C57.7,63 64,56.7 64,49 C64,41.3 57.7,35 50,35 Z" />
                                                <path d="M50,45 C47.8,45 46,46.8 46,49 C46,51.2 47.8,53 50,53 C52.2,53 54,51.2 54,49 C54,46.8 52.2,45 50,45 Z" />
                                            </g>
                                        </svg>
                                    </div>
                                    <div className="fingerprint-message">
                                        Sistema de autenticación por huella digital
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="card mt-4">
                            <div className="card-title">Gestión de Candidatos</div>
                            <div className="form-container">
                                <div className="input-group">
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Nombre del candidato"
                                        value={nuevoNombre}
                                        onChange={(e) => setNuevoNombre(e.target.value)}
                                    />
                                    <textarea
                                        className="form-input mt-2"
                                        placeholder="Descripción del candidato"
                                        value={nuevaDescripcion}
                                        onChange={(e) => setNuevaDescripcion(e.target.value)}
                                        rows="3"
                                    ></textarea>
                                    <button className="btn-primary mt-2" onClick={agregarCandidato}>
                                        <Plus size={16} /> Agregar
                                    </button>
                                </div>
                                {mensaje && <div className={`message ${mensaje.includes('Error') ? 'error' : ''}`}>{mensaje}</div>}

                                <div className="candidates-list mt-4">
                                    <h3>Candidatos Registrados ({candidatos.length})</h3>
                                    <table className="candidates-table">
                                        <thead>
                                        <tr>
                                            <th style={{width: '80%'}}>Nombre</th>
                                            <th style={{width: '20%'}}>Acciones</th>
                                        </tr>
                                        </thead>
                                        <tbody>
                                        {candidatos.map((candidato) => (
                                            <tr key={candidato.id_candidato}>
                                                <td>{candidato.nombre}</td>
                                                <td>
                                                    <button
                                                        className="btn-danger"
                                                        onClick={() => eliminarCandidato(candidato.id_candidato)}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </>
                );
            case 'candidatos':
                return (
                    <div className="card">
                        <div className="card-title">Información de Candidatos</div>
                        <div className="p-4">
                            {candidatos.length > 0 ? (
                                <div className="candidatos-grid">
                                    {candidatos.map((candidato) => (
                                        <div className="candidato-card" key={candidato.id_candidato}>
                                            <h3>{candidato.nombre}</h3>
                                            <p>{candidato.descripcion || 'Sin descripción'}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p>No hay candidatos registrados.</p>
                            )}
                        </div>
                    </div>
                );
            default:
                return (
                    <div className="card">
                        <div className="card-title">Dashboard</div>
                        <p className="p-4">Bienvenido al sistema.</p>
                    </div>
                );
        }
    };

    return (
        <div className="App">
            <div className="main-container">
                <div className="sidebar">
                    <div className="sidebar-logo">
                        <div>DeD</div>
                    </div>
                    <div className="sidebar-menu">
                        <div
                            className={`sidebar-item ${activeSection === 'dashboard' ? 'active' : ''}`}
                            onClick={() => setActiveSection('dashboard')}
                        >
                            <div className="sidebar-item-icon">
                                <Activity size={24} />
                            </div>
                            <div className="sidebar-item-label">Dashboard</div>
                        </div>
                        <div
                            className={`sidebar-item ${activeSection === 'candidatos' ? 'active' : ''}`}
                            onClick={() => setActiveSection('candidatos')}
                        >
                            <div className="sidebar-item-icon">
                                <PieChart size={24} />
                            </div>
                            <div className="sidebar-item-label">Candidatos</div>
                        </div>
                    </div>
                </div>
                <div className="dashboard">
                    <div className="dashboard-header">
                        <h2 className="dashboard-title">DeDoCracia</h2>
                    </div>
                    {renderContent()}
                </div>
            </div>

            <div className="footer">
                © 2025 DeDoCracia S.A.S. Todos los derechos reservados
            </div>
        </div>
    );
};

export default Dashboard;