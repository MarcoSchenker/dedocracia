import React from 'react';
import { Users, Map, PieChart, Activity, FileText, Key, Settings } from 'lucide-react';

const Sidebar = ({ activeSection, onSectionChange }) => {
    const menuItems = [
        {
            id: 'dashboard',
            name: 'Dashboard',
            icon: <Activity size={24} />
        },
        {
            id: 'lideres',
            name: 'Líderes',
            icon: <Users size={24} />
        },
        {
            id: 'estadisticas',
            name: 'Estadísticas',
            icon: <PieChart size={24} />
        },
        {
            id: 'regiones',
            name: 'Regiones',
            icon: <Map size={24} />
        },
        {
            id: 'reportes',
            name: 'Reportes',
            icon: <FileText size={24} />
        },
        {
            id: 'autenticacion',
            name: 'Autenticación',
            icon: <Key size={24} />
        },
        {
            id: 'configuracion',
            name: 'Configuración',
            icon: <Settings size={24} />
        }
    ];

    return (
        <div className="sidebar">
            <div className="sidebar-logo">
                <div>DeD</div>
            </div>
            <div className="sidebar-menu">
                {menuItems.map(item => (
                    <div
                        key={item.id}
                        className={`sidebar-item ${activeSection === item.id ? 'active' : ''}`}
                        onClick={() => onSectionChange(item.id)}
                    >
                        <div className="sidebar-item-icon">{item.icon}</div>
                        <div className="sidebar-item-label">{item.name}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Sidebar;