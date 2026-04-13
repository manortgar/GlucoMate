import React, { useState } from 'react';
import {
    Modal, View, Text, TextInput, TouchableOpacity,
    StyleSheet, ActivityIndicator
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const FoodModal = ({ visible, onClose, onSave, userProfile, isSaving }) => {
    const hasFastInsulin = !!userProfile?.fast_insulin_id;

    const [carbs, setCarbs] = useState('');
    const [units, setUnits] = useState('');
    const [hour, setHour] = useState(new Date().getHours().toString().padStart(2, '0'));
    const [minute, setMinute] = useState(new Date().getMinutes().toString().padStart(2, '0'));

    const handleSave = () => {
        if (!carbs || isNaN(carbs)) return;

        const eventDate = new Date();
        eventDate.setHours(parseInt(hour, 10) || 0);
        eventDate.setMinutes(parseInt(minute, 10) || 0);
        eventDate.setSeconds(0);

        if (eventDate > new Date()) {
            eventDate.setDate(eventDate.getDate() - 1);
        }

        const pad = (n) => (n < 10 ? '0' + n : n);
        const localISO = eventDate.getFullYear() + '-'
            + pad(eventDate.getMonth() + 1) + '-'
            + pad(eventDate.getDate()) + 'T'
            + pad(eventDate.getHours()) + ':'
            + pad(eventDate.getMinutes()) + ':'
            + pad(eventDate.getSeconds());

        onSave({
            carbs: parseFloat(carbs),
            units: units ? parseFloat(units) : 0,
            event_time: localISO
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
                    <Text style={styles.title}>Registrar Comida</Text>

                    {/* Input de Carbos */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Carbohidratos (Gramos)</Text>
                        <TextInput
                            style={styles.numericInput}
                            keyboardType="numeric"
                            placeholder="0g"
                            value={carbs}
                            onChangeText={setCarbs}
                        />
                    </View>

                    {/* Input de Unidades */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Bolo de Insulina Rápida</Text>
                        <TextInput
                            style={[styles.numericInput, !hasFastInsulin && styles.inputDisabled]}
                            keyboardType="numeric"
                            placeholder="0u"
                            value={units}
                            onChangeText={setUnits}
                            editable={hasFastInsulin}
                        />
                        {!hasFastInsulin && (
                            <Text style={styles.errorText}>Agrega medicación al perfil</Text>
                        )}
                    </View>

                    {/* Selector de Hora (JS Puro) */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Hora de Ingesta (HH:MM)</Text>
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
                    </View>

                    {/* Botones de acción */}
                    <View style={styles.actionButtons}>
                        <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={isSaving}>
                            <Text style={styles.cancelText}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.saveButton, !carbs && styles.saveButtonDisabled]}
                            onPress={handleSave}
                            disabled={isSaving || !carbs}
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
        width: '100%',
    },
    inputDisabled: {
        backgroundColor: '#eeeeee',
        color: '#9e9e9e',
    },
    errorText: {
        color: '#f44336',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 5,
        fontWeight: '500',
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
        backgroundColor: '#4caf50', // Verde para comida
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveButtonDisabled: {
        backgroundColor: '#a5d6a7',
    },
    saveText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
});

export default FoodModal;
