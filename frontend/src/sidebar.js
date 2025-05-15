import React from 'react';

const Sidebar = ({ activeSection, onSectionChange }) => {
    const menuItems = [

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