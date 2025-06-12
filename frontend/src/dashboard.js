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
    const [estadoConexion, setEstadoConexion] = useState('conectado');
    const [totalVotos, setTotalVotos] = useState(0);
    
    // Estados para manejar empates
    const [hayEmpate, setHayEmpate] = useState(false);
    const [candidatosEmpatados, setCandidatosEmpatados] = useState([]);
    const [votosEmpate, setVotosEmpate] = useState(0);
    
    // Estados para manejar el inicio de votación
    const [votacionIniciada, setVotacionIniciada] = useState(false);
    const [iniciandoVotacion, setIniciandoVotacion] = useState(false);

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
            setEstadoConexion('conectando');
            const response = await fetch(`${API_BASE_URL}/api/candidatos`);
            if (!response.ok) throw new Error('Error en la respuesta del servidor');
            const data = await response.json();
            setCandidatos(data);
            setEstadoConexion('conectado');
        } catch (error) {
            console.error('Error al obtener candidatos:', error);
            setEstadoConexion('error');
            throw error;
        }
    };

    // Función para obtener estadísticas
    const fetchEstadisticas = async () => {
        try {
            setEstadoConexion('conectando');
            const response = await fetch(`${API_BASE_URL}/api/estadisticas`);
            if (!response.ok) throw new Error('Error en la respuesta del servidor');
            const data = await response.json();
            setEstadisticas(data);
            
            // Calcular total de votos
            const total = data.reduce((sum, candidato) => sum + parseInt(candidato.total_votos || 0), 0);
            setTotalVotos(total);
            setEstadoConexion('conectado');
        } catch (error) {
            console.error('Error al obtener estadísticas:', error);
            setEstadoConexion('error');
            throw error;
        }
    };
    // Función para agregar candidato
    const agregarCandidato = async () => {
        if (votacionFinalizada) {
            setMensaje('No se pueden agregar candidatos después de finalizar la votación');
            return;
        }
        
        if (votacionIniciada) {
            setMensaje('No se pueden agregar candidatos después de iniciar la votación');
            return;
        }
        
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
                setMensaje('✅ Candidato agregado correctamente');
                // Refrescar la lista de candidatos
                await Promise.all([
                    fetchCandidatos(),
                    fetchEstadisticas()
                ]);
                
                // Limpiar mensaje después de 3 segundos
                setTimeout(() => setMensaje(''), 3000);
            
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
        if (votacionIniciada) {
            setMensaje('No se pueden eliminar candidatos después de iniciar la votación');
            return;
        }
        
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

    // Función para iniciar votación
    const iniciarVotacion = async () => {
        if (candidatos.length < 2) {
            setMensaje('Se necesitan al menos 2 candidatos para iniciar la votación');
            return;
        }

        if (!window.confirm('¿Está seguro de que desea iniciar la votación? Los candidatos se enviarán al ESP32 y comenzará el proceso de votación.')) {
            return;
        }

        setIniciandoVotacion(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/iniciar-votacion`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (response.ok) {
                const resultado = await response.json();
                setVotacionIniciada(true);
                setMensaje('🚀 Votación iniciada correctamente. Los candidatos han sido enviados al ESP32.');
                console.log('🚀 Votación iniciada:', resultado);
                
                // Limpiar mensaje después de 5 segundos
                setTimeout(() => setMensaje(''), 5000);
            } else {
                const error = await response.json();
                setMensaje(`Error al iniciar votación: ${error.error}`);
            }
        } catch (error) {
            console.error('Error al iniciar votación:', error);
            setMensaje('Error al conectar con el servidor para iniciar votación');
        } finally {
            setIniciandoVotacion(false);
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
                setEstadisticas(resultado.estadisticas);
                
                if (resultado.empate) {
                    // Es un empate
                    setHayEmpate(true);
                    setCandidatosEmpatados(resultado.candidatos_empatados);
                    setVotosEmpate(resultado.votos_empate);
                    setGanador(null);
                    
                    const nombresEmpatados = resultado.candidatos_empatados.map(c => c.nombre).join(' y ');
                    setMensaje(`🤝 EMPATE: ${nombresEmpatados} con ${resultado.votos_empate} votos cada uno`);
                    console.log('🤝 Empate detectado:', resultado);
                } else {
                    // Hay ganador
                    setHayEmpate(false);
                    setCandidatosEmpatados([]);
                    setVotosEmpate(0);
                    setGanador(resultado.ganador);
                    
                    setMensaje(`Votación finalizada. Ganador: ${resultado.ganador.nombre} con ${resultado.ganador.votos} votos`);
                    console.log('🏆 Resultado de la votación:', resultado);
                }
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

    // Función para iniciar nueva votación
    const nuevaVotacion = async () => {
        if (!window.confirm('¿Está seguro de que desea iniciar una nueva votación? Esto eliminará todos los datos actuales (candidatos, votos y usuarios).')) {
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/nueva-votacion`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (response.ok) {
                const resultado = await response.json();
                // Resetear todos los estados
                setCandidatos([]);
                setEstadisticas([]);
                setGanador(null);
                setVotacionFinalizada(false);
                setVotacionIniciada(false);
                setHayEmpate(false);
                setCandidatosEmpatados([]);
                setVotosEmpate(0);
                setMensaje('Nueva votación iniciada. Todos los datos han sido limpiados.');
                
                // Recargar datos
                await Promise.all([
                    fetchCandidatos(),
                    fetchEstadisticas(),
                ]);
                
                console.log('🎉 Nueva votación iniciada:', resultado);
            } else {
                const error = await response.json();
                setMensaje(`Error al iniciar nueva votación: ${error.error}`);
            }
        } catch (error) {
            console.error('Error al iniciar nueva votación:', error);
            setMensaje('Error al conectar con el servidor para iniciar nueva votación');
        } finally {
            setLoading(false);
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
                        {/* Mensaje informativo cuando hay candidatos pero no se ha iniciado la votación */}
                        {!votacionIniciada && !votacionFinalizada && candidatos.length >= 2 && (
                            <div className="card info-card">
                                <div className="card-title">📋 Candidatos Listos</div>
                                <div className="info-content">
                                    <p>Tienes {candidatos.length} candidatos registrados. Presiona "Iniciar Votación" para enviar los candidatos al ESP32 y comenzar el proceso de votación.</p>
                                </div>
                            </div>
                        )}

                        {/* Mensaje informativo cuando la votación está iniciada */}
                        {votacionIniciada && !votacionFinalizada && (
                            <div className="card success-card">
                                <div className="card-title">✅ Votación en Curso</div>
                                <div className="success-content">
                                    <p>La votación está activa. Los candidatos han sido enviados al ESP32 y los usuarios pueden votar usando sus huellas dactilares.</p>
                                </div>
                            </div>
                        )}

                        {/* Mensaje del ganador si la votación está finalizada */}
                        {votacionFinalizada && ganador && !hayEmpate && (
                            <div className="card winner-card">
                                <div className="card-title">🏆 GANADOR DE LA VOTACIÓN</div>
                                <div className="winner-info">
                                    <h2 className="winner-name">{ganador.nombre}</h2>
                                    <p className="winner-votes">{ganador.votos} votos</p>
                                    <div className="winner-message">¡Felicitaciones al ganador!</div>
                                </div>
                            </div>
                        )}

                        {/* Mensaje de empate si la votación está finalizada con empate */}
                        {votacionFinalizada && hayEmpate && candidatosEmpatados.length > 0 && (
                            <div className="card tie-card">
                                <div className="card-title">🤝 EMPATE EN LA VOTACIÓN</div>
                                <div className="tie-info">
                                    <h2 className="tie-candidates">
                                        {candidatosEmpatados.map(c => c.nombre).join(' y ')}
                                    </h2>
                                    <p className="tie-votes">{votosEmpate} votos cada uno</p>
                                    <div className="tie-message">¡Se necesita una nueva votación para desempatar!</div>
                                </div>
                            </div>
                        )}

                        {/* Layout de dos columnas: Gráfico a la izquierda, Gestión a la derecha */}
                        <div className="dashboard-content">
                            {/* Columna izquierda - Gráfico más angosto */}
                            <div className="dashboard-left">
                                <div className="chart-container">
                                    <div className="card">
                                        <div className="card-title">Información Estadística</div>
                                        <div className="stats-container">
                                            <div className="stats-header">                                <div className="stats-title">Región Austral</div>
                                <div className="buttons-container">
                                    {!votacionIniciada && !votacionFinalizada ? (
                                        <button 
                                            className="btn btn-success"
                                            onClick={iniciarVotacion}
                                            disabled={iniciandoVotacion || candidatos.length < 2}
                                            title={candidatos.length < 2 ? "Se necesitan al menos 2 candidatos" : "Iniciar votación y enviar candidatos al ESP32"}
                                        >
                                            {iniciandoVotacion ? 'Iniciando...' : 'Iniciar Votación'}
                                        </button>
                                    ) : !votacionFinalizada ? (
                                        <button 
                                            className="btn btn-danger"
                                            onClick={finalizarVotacion}
                                            disabled={finalizandoVotacion}
                                        >
                                            {finalizandoVotacion ? 'Finalizando...' : 'Finalizar'}
                                        </button>
                                    ) : (
                                        <button 
                                            className="btn btn-primary"
                                            onClick={nuevaVotacion}
                                            disabled={loading}
                                        >
                                            {loading ? 'Iniciando...' : 'Nueva Votación'}
                                        </button>
                                    )}
                                </div>
                                            </div>
                                            <div className="stats-chart">
                                                <ResponsiveContainer width="100%" height={300}>
                                                    <BarChart data={estadisticas} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                                        <XAxis 
                                                            dataKey="nombre" 
                                                            tick={{ fontSize: 12 }}
                                                            interval={0}
                                                        />
                                                        <YAxis tick={{ fontSize: 12 }} />
                                                        <Tooltip 
                                                            contentStyle={{
                                                                backgroundColor: 'white',
                                                                border: '1px solid #e5e7eb',
                                                                borderRadius: '8px',
                                                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                                            }}
                                                            formatter={(value, name) => [
                                                                `${value} votos`,
                                                                'Total'
                                                            ]}
                                                        />
                                                        <Bar 
                                                            dataKey="total_votos" 
                                                            fill="#2052d3" 
                                                            radius={[4, 4, 0, 0]}
                                                        />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                                {estadisticas.length === 0 && (
                                                    <div className="chart-empty-state">
                                                        <p>No hay datos de votación disponibles</p>
                                                        <p className="text-sm text-light">Los votos aparecerán aquí cuando se registren</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Columna derecha - Gestión de usuarios */}
                            <div className="dashboard-right">
                                <div className="user-management">
                                    <div className="card-title">Gestión de Candidatos</div>
                                    <div className="form-container">
                                        <div className="input-group">
                                            <input
                                                type="text"
                                                className="form-input"
                                                placeholder="Nombre del candidato"
                                                value={nuevoNombre}
                                                onChange={(e) => setNuevoNombre(e.target.value)}
                                                disabled={votacionFinalizada || votacionIniciada}
                                            />
                                            <textarea
                                                className="form-input mt-2"
                                                placeholder="Descripción del candidato"
                                                value={nuevaDescripcion}
                                                onChange={(e) => setNuevaDescripcion(e.target.value)}
                                                rows="3"
                                                disabled={votacionFinalizada || votacionIniciada}
                                            ></textarea>
                                            <button 
                                                className="btn-primary btn-large mt-2" 
                                                onClick={agregarCandidato}
                                                disabled={votacionFinalizada || votacionIniciada}
                                                title={
                                                    votacionFinalizada ? "No se pueden agregar candidatos después de finalizar" : 
                                                    votacionIniciada ? "No se pueden agregar candidatos después de iniciar la votación" :
                                                    "Agregar nuevo candidato"
                                                }
                                            >
                                                <Plus size={20} /> {
                                                    votacionFinalizada ? 'Votación Finalizada' : 
                                                    votacionIniciada ? 'Votación Iniciada' :
                                                    'Agregar Candidato'
                                                }
                                            </button>
                                        </div>
                                        {mensaje && <div className={`message ${mensaje.includes('Error') ? 'error' : ''}`}>{mensaje}</div>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Sección de candidatos - Ancho completo */}
                        <div className="candidatos-section">
                            <div className="card">
                                <div className="card-title">Candidatos Registrados ({candidatos.length})</div>
                                <div className="candidates-list">
                                    {candidatos.length > 0 ? (
                                        <table className="candidates-table">
                                            <thead>
                                                <tr>
                                                    <th style={{width: '50%'}}>Nombre</th>
                                                    <th style={{width: '30%'}}>Votos</th>
                                                    <th style={{width: '20%'}}>Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {candidatos.map((candidato) => {
                                                    const estadistica = estadisticas.find(est => est.id_candidato === candidato.id_candidato);
                                                    const votos = estadistica ? parseInt(estadistica.total_votos) : 0;
                                                    const porcentaje = totalVotos > 0 ? ((votos / totalVotos) * 100).toFixed(1) : 0;
                                                    
                                                    return (
                                                        <tr key={candidato.id_candidato}>
                                                            <td>
                                                                <div className="candidate-info">
                                                                    <strong>{candidato.nombre}</strong>
                                                                    {candidato.descripcion && (
                                                                        <div className="candidate-description">
                                                                            {candidato.descripcion}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <div className="vote-info">
                                                                    <span className="vote-count">{votos}</span>
                                                                    <span className="vote-percentage">({porcentaje}%)</span>
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <button
                                                                    className="btn-danger"
                                                                    onClick={() => eliminarCandidato(candidato.id_candidato)}
                                                                    disabled={votacionFinalizada || votacionIniciada}
                                                                    title={
                                                                        votacionFinalizada ? "No se pueden eliminar candidatos después de finalizar" :
                                                                        votacionIniciada ? "No se pueden eliminar candidatos después de iniciar la votación" :
                                                                        "Eliminar candidato"
                                                                    }
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="empty-state">
                                            <p>No hay candidatos registrados.</p>
                                            <p className="text-sm text-light">Agregue candidatos usando el formulario anterior.</p>
                                        </div>
                                    )}
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
                    <div className="sidebar-header">
                        <h1 className="sidebar-title">DeDoCracia</h1>
                        <p className="sidebar-subtitle">Sistema Electoral</p>
                    </div>
                    <nav className="sidebar-nav">
                        <button
                            className={`nav-item ${activeSection === 'dashboard' ? 'active' : ''}`}
                            onClick={() => setActiveSection('dashboard')}
                        >
                            <Activity size={20} style={{marginRight: '0.75rem'}} />
                            Dashboard
                        </button>
                        <button
                            className={`nav-item ${activeSection === 'candidatos' ? 'active' : ''}`}
                            onClick={() => setActiveSection('candidatos')}
                        >
                            <PieChart size={20} style={{marginRight: '0.75rem'}} />
                            Candidatos
                        </button>
                    </nav>
                </div>
                <div className="dashboard">
                    <div className="dashboard-header">
                        <div>
                            <h2 className="dashboard-title">DeDoCracia</h2>
                            <p className="dashboard-subtitle">Sistema de Votación Electrónica Segura</p>
                        </div>
                        <div className="dashboard-stats">
                            <div className="stat-item">
                                <span className="stat-label">Total Votos:</span>
                                <span className="stat-value">{totalVotos}</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-label">Candidatos:</span>
                                <span className="stat-value">{candidatos.length}</span>
                            </div>
                            <div className={`connection-status ${estadoConexion}`}>
                                <span className="status-indicator"></span>
                                {estadoConexion === 'conectado' && 'Conectado'}
                                {estadoConexion === 'conectando' && 'Conectando...'}
                                {estadoConexion === 'error' && 'Sin conexión'}
                            </div>
                        </div>
                    </div>
                    {renderContent()}
                </div>
            </div>

            <div className="footer">
                <div className="footer-content">
                    <div className="footer-section">
                        <strong>© 2025 DeDoCracia S.A.S.</strong>
                        <span>Sistema de Votación Electrónica Segura</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;