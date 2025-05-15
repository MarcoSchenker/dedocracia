import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, Map, PieChart, Activity, TrendingUp, TrendingDown, Plus } from 'lucide-react';

const Dashboard = () => {
    const [candidatos, setCandidatos] = useState([]);
    const [estadisticas, setEstadisticas] = useState([]);
    const [lideres, setLideres] = useState([]);
    const [activeSection, setActiveSection] = useState('dashboard');
    const [nuevoNombre, setNuevoNombre] = useState('');
    const [mensaje, setMensaje] = useState('');

    // Cargar datos
    useEffect(() => {
        fetchCandidatos();
        fetchEstadisticas();
        fetchLideres();
    }, []);

    // Función para obtener candidatos
    const fetchCandidatos = async () => {
        try {
            const response = await fetch('http://localhost:3001/api/candidatos');
            const data = await response.json();
            setCandidatos(data);
        } catch (error) {
            console.error('Error al obtener candidatos:', error);
        }
    };

    // Función para obtener estadísticas
    const fetchEstadisticas = async () => {
        try {
            const response = await fetch('http://localhost:3001/api/estadisticas');
            const data = await response.json();
            setEstadisticas(data);
        } catch (error) {
            console.error('Error al obtener estadísticas:', error);
        }
    };

    // Función para obtener líderes
    const fetchLideres = async () => {
        try {
            const response = await fetch('http://localhost:3001/api/lideres');
            const data = await response.json();
            setLideres(data);
        } catch (error) {
            console.error('Error al obtener líderes:', error);
        }
    };

    // Función para agregar candidato
    const agregarCandidato = async () => {
        if (!nuevoNombre.trim()) {
            setMensaje('El nombre del candidato es requerido');
            return;
        }

        try {
            const response = await fetch('http://localhost:3001/api/candidatos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ nombre: nuevoNombre }),
            });

            if (response.ok) {
                setNuevoNombre('');
                setMensaje('Candidato agregado correctamente');
                // Refrescar la lista de candidatos
                fetchCandidatos();
                fetchEstadisticas();
                fetchLideres();
            } else {
                const error = await response.json();
                setMensaje(`Error: ${error.error}`);
            }
        } catch (error) {
            console.error('Error al agregar candidato:', error);
            setMensaje('Error al conectar con el servidor');
        }
    };

    const renderContent = () => {
        switch (activeSection) {
            case 'dashboard':
                return (
                    <>
                        <div className="dashboard-grid">
                            <div className="card">
                                <div className="card-title">Información Estadística</div>
                                <div className="stats-container">
                                    <div className="stats-header">
                                        <div className="stats-title">Región Austral</div>
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
                                    <button className="btn-primary" onClick={agregarCandidato}>
                                        <Plus size={16} /> Agregar
                                    </button>
                                </div>
                                {mensaje && <div className="message">{mensaje}</div>}

                                <div className="candidates-list mt-4">
                                    <h3>Candidatos Registrados ({candidatos.length})</h3>
                                    <table className="candidates-table">
                                        <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Nombre</th>
                                        </tr>
                                        </thead>
                                        <tbody>
                                        {candidatos.map((candidato) => (
                                            <tr key={candidato.id_candidato}>
                                                <td>{candidato.id_candidato}</td>
                                                <td>{candidato.nombre}</td>
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="card mt-4">
                            <div className="card-title">Top Líderes</div>
                            <table className="leaders-table">
                                <thead>
                                <tr>
                                    <th>Nombre</th>
                                    <th>Comuna</th>
                                    <th>Votos Totales</th>
                                    <th>Actualización</th>
                                </tr>
                                </thead>
                                <tbody>
                                {lideres.map((lider) => (
                                    <tr key={lider.id_candidato}>
                                        <td>{lider.nombre}</td>
                                        <td>{lider.id_candidato < 4 ? lider.id_candidato : 1}</td>
                                        <td>{lider.votos_totales ? lider.votos_totales.toLocaleString() : '0'}</td>
                                        <td>
                                            {lider.tendencia === 'down' ? (
                                                <TrendingDown className="trend-down" size={18} />
                                            ) : (
                                                <TrendingUp className="trend-up" size={18} />
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                );
            case 'lideres':
                return (
                    <div className="card">
                        <div className="card-title">Información de Líderes</div>
                        <p className="p-4">Sección de líderes en desarrollo.</p>
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
                            className={`sidebar-item ${activeSection === 'lideres' ? 'active' : ''}`}
                            onClick={() => setActiveSection('lideres')}
                        >
                            <div className="sidebar-item-icon">
                                <Users size={24} />
                            </div>
                            <div className="sidebar-item-label">Líderes</div>
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