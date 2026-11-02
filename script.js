/**
 * Smart Parking System - API Communication Layer
 * Connects Frontend to C++ Backend via HTTP API
 * Backend URL: http://localhost:18080
 */

// ============================================
// API Configuration
// ============================================
const API_BASE_URL = 'http://localhost:18080';
const API_TIMEOUT = 5000; // 5 seconds

// ============================================
// Toast Notification System
// ============================================
function showToast(type, message, duration = 3000) {
    const container = document.getElementById('toastContainer');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️'
    };
    
    toast.innerHTML = `
        <span style="font-size: 20px;">${icons[type]}</span>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Remove after duration
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ============================================
// API Helper Functions
// ============================================
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const defaultOptions = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        mode: 'cors'
    };
    
    const fetchOptions = { ...defaultOptions, ...options };
    
    if (options.body && typeof options.body === 'object') {
        fetchOptions.body = JSON.stringify(options.body);
    }
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
        
        fetchOptions.signal = controller.signal;
        
        const response = await fetch(url, fetchOptions);
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`API Request Failed: ${endpoint}`, error);
        
        // Return mock data for demo purposes when backend is not available
        if (error.name === 'TypeError' || error.name === 'AbortError') {
            console.log('Backend not available - returning mock data');
            return getMockData(endpoint, options);
        }
        
        throw error;
    }
}

// ============================================
// Mock Data Storage (In-Memory for Demo)
// ============================================
const mockStorage = {
    employees: [], // Empty - user can add their own employees
    transactions: [], // Empty - parking is completely empty
    earnings: 0.00 // Reset earnings to zero
};

// ============================================
// Mock Data Generator (For Demo Without Backend)
// ============================================
function getMockData(endpoint, options) {
    // Simulate network delay
    return new Promise((resolve) => {
        setTimeout(() => {
            switch(endpoint) {
                case '/api/status':
                    const parkedVehicles = mockStorage.transactions.filter(t => !t.completed);
                    resolve({
                        success: true,
                        available: 50 - parkedVehicles.length,
                        occupied: parkedVehicles.length,
                        areas: 2,
                        cameras: 4,
                        reserved: 0,
                        timestamp: new Date().toISOString()
                    });
                    break;
                    
                case '/api/slots':
                    resolve([
                        { id: 1, status: 'available', plate: null },
                        { id: 2, status: 'occupied', plate: 'ABC-123' },
                        { id: 3, status: 'available', plate: null },
                        { id: 4, status: 'reserved', plate: null },
                        { id: 5, status: 'occupied', plate: 'XYZ-789' }
                    ]);
                    break;
                    
                case '/api/park':
                    const parkPlate = options.body?.plate || 'UNKNOWN';
                    const parkType = options.body?.type || 'Car';
                    // Add to transactions
                    mockStorage.transactions.push({
                        plate: parkPlate,
                        type: parkType,
                        color: 'Unknown',
                        slotId: Math.floor(Math.random() * 50) + 1,
                        entryTime: Date.now(),
                        hours: 0,
                        fee: 0,
                        completed: false
                    });
                    resolve({
                        success: true,
                        message: `Vehicle ${parkPlate} parked successfully`,
                        slotId: mockStorage.transactions[mockStorage.transactions.length - 1].slotId,
                        area: 'Ground Floor',
                        entryTime: new Date().toISOString(),
                        fee: 0
                    });
                    break;
                    
                case '/api/remove':
                    const slotId = options.body?.slotId;
                    const exitPlate = options.body?.plate;
                    
                    console.log('Remove vehicle request:', { slotId, exitPlate });
                    console.log('Current transactions:', mockStorage.transactions);
                    
                    // Find the vehicle in transactions (try by plate first, then by slotId)
                    let vehicleIndex = mockStorage.transactions.findIndex(t => 
                        t.plate === exitPlate && !t.completed
                    );
                    
                    // If not found by plate, try by slotId
                    if (vehicleIndex === -1 && slotId) {
                        vehicleIndex = mockStorage.transactions.findIndex(t => 
                            t.slotId == slotId && !t.completed
                        );
                    }
                    
                    if (vehicleIndex !== -1) {
                        const vehicle = mockStorage.transactions[vehicleIndex];
                        const now = Date.now();
                        const durationMs = now - vehicle.entryTime;
                        
                        // Calculate accurate time in hours and minutes
                        const totalMinutes = Math.floor(durationMs / (1000 * 60));
                        const hours = Math.floor(totalMinutes / 60);
                        const minutes = totalMinutes % 60;
                        
                        // Calculate fee: $5 per hour, with partial hours counted as full hours
                        // Or $0.0833 per minute (5/60)
                        const fee = (hours * 5) + (minutes > 0 ? (minutes * (5 / 60)) : 0);
                        
                        // Update transaction
                        vehicle.exitTime = now;
                        vehicle.hours = hours + (minutes / 60); // Store as decimal hours
                        vehicle.fee = fee;
                        vehicle.completed = true;
                        
                        // Add to earnings
                        mockStorage.earnings += fee;
                        
                        resolve({
                            success: true,
                            message: 'Vehicle removed successfully',
                            plate: vehicle.plate,
                            duration: `${hours}h ${minutes}m`,
                            fee: fee,
                            exitTime: new Date().toISOString()
                        });
                    } else {
                        resolve({
                            success: false,
                            message: 'Vehicle not found or already exited'
                        });
                    }
                    break;
                    
                case '/api/employees':
                    resolve([...mockStorage.employees]);
                    break;
                    
                case '/api/employees/add':
                    mockStorage.employees.push(options.body);
                    resolve({
                        success: true,
                        message: 'Employee added successfully',
                        employee: options.body
                    });
                    break;
                    
                case '/api/report':
                    const completedTx = mockStorage.transactions.filter(t => t.completed);
                    const parkedTx = mockStorage.transactions.filter(t => !t.completed);
                    resolve({
                        success: true,
                        date: new Date().toISOString().split('T')[0],
                        earnings: mockStorage.earnings,
                        dailyEntries: mockStorage.transactions.length,
                        currentlyParked: parkedTx.length,
                        transactions: completedTx.length,
                        avgDuration: '2h 15m',
                        peakHour: '14:00 - 16:00',
                        hourlyData: [8, 12, 15, 20, 18, 25, 30, 28, 20, 15, 10, 5]
                    });
                    break;
                    
                case '/api/transactions':
                    resolve([...mockStorage.transactions]);
                    break;
                    
                case '/api/cameras':
                    resolve([
                        { id: 'C1', status: 'active', location: 'Ground Floor Entrance', lastCapture: new Date().toISOString() },
                        { id: 'C2', status: 'active', location: 'First Floor Exit', lastCapture: new Date().toISOString() },
                        { id: 'C3', status: 'active', location: 'Ground Floor Exit', lastCapture: new Date().toISOString() },
                        { id: 'C4', status: 'active', location: 'Basement', lastCapture: new Date().toISOString() }
                    ]);
                    break;
                    
                case '/api/areas':
                    resolve([
                        { id: 1, name: 'Ground Floor', lines: 5, totalSlots: 50, availableSlots: 32, occupiedSlots: 15, reservedSlots: 3 },
                        { id: 2, name: 'First Floor', lines: 4, totalSlots: 40, availableSlots: 18, occupiedSlots: 20, reservedSlots: 2 }
                    ]);
                    break;
                    
                case '/api/clear-all':
                    mockStorage.transactions = [];
                    mockStorage.employees = [];
                    mockStorage.earnings = 0.00;
                    resolve({
                        success: true,
                        message: 'All parking data cleared successfully'
                    });
                    break;
                    
                case '/api/areas/increase':
                    resolve({
                        success: true,
                        message: `Capacity increased by ${options.body?.additionalSlots || 10} slots`
                    });
                    break;
                    
                case '/api/slots/reserve':
                    resolve({
                        success: true,
                        message: `${options.body?.slots?.length || 0} slots reserved successfully`
                    });
                    break;
                    
                default:
                    resolve({ success: true, message: 'Mock response' });
            }
        }, 500); // 500ms simulated delay
    });
}

// ============================================
// API Endpoints Object
// ============================================
const api = {
    // Get system status
    getStatus: () => apiRequest('/api/status'),
    
    // Get all parking slots
    getSlots: () => apiRequest('/api/slots'),
    
    // Park a vehicle (entry)
    parkVehicle: (plate, type = 'car') => apiRequest('/api/park', {
        method: 'POST',
        body: { plate, type, timestamp: new Date().toISOString() }
    }),
    
    // Remove a vehicle (exit)
    removeVehicle: (slotId, plate = null) => apiRequest('/api/remove', {
        method: 'POST',
        body: { slotId, plate, timestamp: new Date().toISOString() }
    }),
    
    // Get all employees
    getEmployees: () => apiRequest('/api/employees'),
    
    // Add new employee
    addEmployee: (employeeData) => apiRequest('/api/employees/add', {
        method: 'POST',
        body: employeeData
    }),
    
    // Get daily report
    getReport: () => apiRequest('/api/report'),
    
    // Get all cameras
    getCameras: () => apiRequest('/api/cameras'),
    
    // Get parking areas
    getAreas: () => apiRequest('/api/areas'),
    
    // Get all transactions (car entries)
    getTransactions: () => apiRequest('/api/transactions'),
    
    // Increase area capacity
    increaseCapacity: (areaId, additionalSlots) => apiRequest('/api/areas/increase', {
        method: 'POST',
        body: { areaId, additionalSlots }
    }),
    
    // Reserve slots
    reserveSlots: (slots, reservationInfo) => apiRequest('/api/slots/reserve', {
        method: 'POST',
        body: { slots, reservationInfo }
    }),
    
    // Clear all parking data
    clearAllParking: () => apiRequest('/api/clear-all', {
        method: 'POST'
    })
};

// ============================================
// Utility Functions
// ============================================

// Format currency
function formatCurrency(amount) {
    return '$' + parseFloat(amount).toFixed(2);
}

// Format duration from hours
function formatDuration(hours) {
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    return `${h}h ${m}m`;
}

// Calculate parking fee
function calculateParkingFee(entryTime, exitTime, ratePerHour = 5) {
    const entry = new Date(entryTime);
    const exit = new Date(exitTime);
    const diffMs = exit - entry;
    const diffHours = diffMs / (1000 * 60 * 60);
    return Math.ceil(diffHours) * ratePerHour;
}

// Validate license plate
function validatePlate(plate) {
    // Basic validation - alphanumeric with optional hyphen
    const pattern = /^[A-Z0-9]{2,8}(-[A-Z0-9]{2,4})?$/i;
    return pattern.test(plate);
}

// Generate unique ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Format date for display
function formatDate(date) {
    return new Date(date).toLocaleString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ============================================
// Real-time Updates Manager
// ============================================
class RealtimeManager {
    constructor() {
        this.subscribers = {};
        this.intervals = {};
    }
    
    subscribe(channel, callback, interval = 2000) {
        if (!this.subscribers[channel]) {
            this.subscribers[channel] = [];
        }
        this.subscribers[channel].push(callback);
        
        // Start polling if not already started
        if (!this.intervals[channel]) {
            this.startPolling(channel, interval);
        }
    }
    
    unsubscribe(channel, callback) {
        if (this.subscribers[channel]) {
            this.subscribers[channel] = this.subscribers[channel].filter(cb => cb !== callback);
        }
    }
    
    startPolling(channel, interval) {
        const poll = async () => {
            try {
                let data;
                switch(channel) {
                    case 'status':
                        data = await api.getStatus();
                        break;
                    case 'slots':
                        data = await api.getSlots();
                        break;
                    case 'cameras':
                        data = await api.getCameras();
                        break;
                    default:
                        data = await api.getStatus();
                }
                
                // Notify all subscribers
                if (this.subscribers[channel]) {
                    this.subscribers[channel].forEach(callback => callback(data));
                }
            } catch (error) {
                console.error(`Polling error for ${channel}:`, error);
            }
        };
        
        poll(); // Initial call
        this.intervals[channel] = setInterval(poll, interval);
    }
    
    stopPolling(channel) {
        if (this.intervals[channel]) {
            clearInterval(this.intervals[channel]);
            delete this.intervals[channel];
        }
    }
    
    stopAll() {
        Object.keys(this.intervals).forEach(channel => {
            this.stopPolling(channel);
        });
    }
}

// Create global realtime manager instance
const realtime = new RealtimeManager();

// ============================================
// Animation Helpers
// ============================================

// Animate number counting
function animateNumber(element, target, duration = 1000) {
    const start = parseInt(element.textContent) || 0;
    const diff = target - start;
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function (ease-out)
        const easeOut = 1 - Math.pow(1 - progress, 3);
        
        const current = Math.floor(start + diff * easeOut);
        element.textContent = current;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

// Pulse animation for elements
function pulseElement(element) {
    element.style.animation = 'none';
    element.offsetHeight; // Trigger reflow
    element.style.animation = 'pulse 0.5s ease-in-out';
}

// Smooth scroll to element
function scrollToElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ============================================
// Local Storage Helpers
// ============================================
const storage = {
    set: (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('Storage error:', e);
        }
    },
    
    get: (key, defaultValue = null) => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.error('Storage error:', e);
            return defaultValue;
        }
    },
    
    remove: (key) => {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.error('Storage error:', e);
        }
    },
    
    clear: () => {
        try {
            localStorage.clear();
        } catch (e) {
            console.error('Storage error:', e);
        }
    }
};

// ============================================
// Export for global access
// ============================================
window.api = api;
window.showToast = showToast;
window.realtime = realtime;
window.storage = storage;
window.formatCurrency = formatCurrency;
window.formatDuration = formatDuration;
window.calculateParkingFee = calculateParkingFee;
window.validatePlate = validatePlate;
window.generateId = generateId;
window.formatDate = formatDate;
window.animateNumber = animateNumber;
window.scrollToElement = scrollToElement;

// ============================================
// Console Welcome Message
// ============================================
console.log('%c🏎️ Smart Parking System', 'font-size: 24px; font-weight: bold; color: #00f0ff;');
console.log('%cAPI Base URL: http://localhost:18080', 'font-size: 14px; color: #bc13fe;');
console.log('%cAvailable API methods:', 'font-size: 12px; color: #39ff14;');
console.log('- api.getStatus()');
console.log('- api.getSlots()');
console.log('- api.parkVehicle(plate, type)');
console.log('- api.removeVehicle(slotId)');
console.log('- api.getEmployees()');
console.log('- api.getReport()');
console.log('- api.getCameras()');
