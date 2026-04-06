import React, { useState } from 'react';
import {
    Modal, View, Text, TextInput, TouchableOpacity,
    StyleSheet, ActivityIndicator
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const InsulinModal = ({ visible, onClose, onSave, userProfile, isSaving }) => {
    // Si no hay perfil, asume nombres por defecto
    const fastName = userProfile?.fast_insulin_name || "Rápida";
    const slowName = userProfile?.slow_insulin_name || "Lenta";

    const [selectedType, setSelectedType] = useState('fast'); // 'fast' o 'slow'
    const [units, setUnits] = useState(null);
    const [hour, setHour] = useState(new Date().getHours().toString().padStart(2, '0'));
    const [minute, setMinute] = useState(new Date().getMinutes().toString().padStart(2, '0'));

    const handleSave = () => {
        if (!units || isNaN(units)) return;

        const insulinId = selectedType === 'fast' ? userProfile?.fast_insulin_id : userProfile?.slow_insulin_id;

        const eventDate = new Date();
        eventDate.setHours(parseInt(hour, 10) || 0);
        eventDate.setMinutes(parseInt(minute, 10) || 0);
        eventDate.setSeconds(0);


        // Si la hora elegida es en el futuro con respecto a la fecha actual, asumimos que fue "ayer"
        if (eventDate > new Date()) {
            eventDate.setDate(eventDate.getDate() - 1);
        }

        onSave({
            insulin_id: insulinId,
            units: parseFloat(units),
            event_time: eventDate.toISOString()
        });
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    <Text style={styles.title}>Registrar Insulina</Text>

                    {/* Selector de Tipo (Rápida vs Lenta) */}
                    <View style={styles.typeSelector}>
                        <TouchableOpacity
                            style={[styles.typeButton, selectedType === 'fast' && styles.typeButtonActive]}
                            onPress={() => setSelectedType('fast')}
                        >
                            <Text style={[styles.typeText, selectedType === 'fast' && styles.typeTextActive]}>
                                {fastName} (Rápida)
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.typeButton, selectedType === 'slow' && styles.typeButtonActiveSlow]}
                            onPress={() => setSelectedType('slow')}
                        >
                            <Text style={[styles.typeText, selectedType === 'slow' && styles.typeTextActive]}>
                                {slowName} (Lenta)
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Input de Unidades */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Cantidad (Unidades)</Text>
                        <TextInput
                            style={styles.numericInput}
                            keyboardType="numeric"
                            placeholder="0"
                            value={units}
                            onChangeText={setUnits}
                        />
                    </View>

                    {/* Selector de Hora (JS Puro) */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Hora de Inyección (HH:MM)</Text>
                        <View style={styles.timeRow}>
                            <MaterialCommunityIcons name="clock-outline" size={24} color="#757575" />
                            <TextInput
                                style={styles.timeInput}
                                keyboardType="number-pad"
                                maxLength={2}
                                value={hour}
                                onChangeText={setHour}
                            />
                            <Text style={styles.timeSeparator}>:</Text>
                            <TextInput
                                style={styles.timeInput}
                                keyboardType="number-pad"
                                maxLength={2}
                                value={minute}
                                onChangeText={setMinute}
                            />
                        </View>
                        <Text style={styles.hint}>Por defecto es la hora actual.</Text>
                    </View>

                    {/* Botones de acción */}
                    <View style={styles.actionButtons}>
                        <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={isSaving}>
                            <Text style={styles.cancelText}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.saveButton, !units && styles.saveButtonDisabled]}
                            onPress={handleSave}
                            disabled={isSaving || !units}
                        >
                            {isSaving ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text style={styles.saveText}>Guardar</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        width: '85%',
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#263238',
        marginBottom: 20,
        textAlign: 'center',
    },
    typeSelector: {
        flexDirection: 'row',
        marginBottom: 20,
        backgroundColor: '#f5f5f5',
        borderRadius: 12,
        padding: 4,
    },
    typeButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        justifyContent: 'center',
        display: 'flex',

    },
    typeButtonActive: {
        backgroundColor: '#e91e63', // Rosa para rápida
    },
    typeButtonActiveSlow: {
        backgroundColor: '#9c27b0', // Morado para lenta
    },
    typeText: {
        color: '#757575',
        fontWeight: '600',
        fontSize: 14,
        textAlign: 'center',
    },
    typeTextActive: {
        color: '#fff',
    },
    inputContainer: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        color: '#546e7a',
        marginBottom: 8,
        fontWeight: '500',
    },
    numericInput: {
        borderWidth: 1,
        borderColor: '#e0e0e0',
        borderRadius: 10,
        height: 50,
        fontSize: 24,
        textAlign: 'center',
        color: '#263238',
        backgroundColor: '#fafafa',
        textAlignVertical: 'center',
        width: '100%',
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    timeInput: {
        borderWidth: 1,
        borderColor: '#e0e0e0',
        borderRadius: 10,
        height: 50,
        width: 60,
        fontSize: 20,
        textAlign: 'center',
        color: '#263238',
        backgroundColor: '#fafafa',
        marginHorizontal: 10,
    },
    timeSeparator: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#546e7a',
    },
    hint: {
        fontSize: 12,
        color: '#90a4ae',
        textAlign: 'center',
        marginTop: 8,
    },
    actionButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 14,
        marginRight: 10,
        borderRadius: 12,
        backgroundColor: '#eeeeee',
        alignItems: 'center',
    },
    cancelText: {
        color: '#757575',
        fontWeight: '600',
        fontSize: 16,
    },
    saveButton: {
        flex: 1,
        paddingVertical: 14,
        marginLeft: 10,
        borderRadius: 12,
        backgroundColor: '#2196F3',
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveButtonDisabled: {
        backgroundColor: '#90caf9',
    },
    saveText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
});

export default InsulinModal;
