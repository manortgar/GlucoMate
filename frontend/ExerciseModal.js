import React, { useState, useEffect } from 'react';
import {
    Modal, View, Text, TextInput, TouchableOpacity,
    StyleSheet, ActivityIndicator
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const ExerciseModal = ({ visible, onClose, onSave, isSaving, backendUrl }) => {
    const [sports, setSports] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [sportId, setSportId] = useState(null);
    const [duration, setDuration] = useState('');
    const [hour, setHour] = useState(new Date().getHours().toString().padStart(2, '0'));
    const [minute, setMinute] = useState(new Date().getMinutes().toString().padStart(2, '0'));

    useEffect(() => {
        if (visible) {
            fetchSports();
            setHour(new Date().getHours().toString().padStart(2, '0'));
            setMinute(new Date().getMinutes().toString().padStart(2, '0'));
            setDuration('');
            setSportId(null);
        }
    }, [visible]);

    const fetchSports = async () => {
        setIsLoading(true);
        try {
            // Reutilizamos el dominio del backendUrl de exercise sacando solo la raiz
            const baseUrl = backendUrl.split('/api/')[0];
            const res = await fetch(`${baseUrl}/api/sports`);
            const data = await res.json();
            setSports(data);
            if (data.length > 0) setSportId(String(data[0].id));
        } catch (error) {
            console.error('Error cargando deportes:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = () => {
        if (!sportId || !duration || isNaN(duration)) return;

        const eventDate = new Date();
        eventDate.setHours(parseInt(hour, 10) || 0);
        eventDate.setMinutes(parseInt(minute, 10) || 0);
        eventDate.setSeconds(0);

        // Si la hora insertada es mayor que la actual, asumimos que fue ayer
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
            sport_id: parseInt(sportId),
            duration_minutes: parseInt(duration, 10),
            start_time: localISO
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
                    <Text style={styles.title}>Registrar Deporte</Text>

                    {isLoading ? (
                        <ActivityIndicator size="large" color="#ff9800" style={{ marginVertical: 20 }} />
                    ) : (
                        <>
                            {/* Selector de Deporte */}
                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>¿Qué actividad realizaste?</Text>
                                <View style={styles.pickerWrapper}>
                                    <Picker
                                        selectedValue={sportId}
                                        onValueChange={(val) => setSportId(val)}
                                        style={styles.picker}
                                    >
                                        {sports.map(s => (
                                            <Picker.Item key={s.id} label={`${s.name} (${s.danger_window_hours}h)`} value={String(s.id)} />
                                        ))}
                                    </Picker>
                                </View>
                            </View>


                            {/* Selector de Hora (Inicio) */}
                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>Hora de Inicio (HH:MM)</Text>
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


                            {/* Input de Duración */}
                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>Duración (minutos)</Text>
                                <TextInput
                                    style={styles.numericInput}
                                    keyboardType="numeric"
                                    placeholder="ej. 45"
                                    value={duration}
                                    onChangeText={setDuration}
                                    maxLength={3}
                                />
                            </View>
                        </>
                    )}

                    {/* Botones de acción */}
                    <View style={styles.actionButtons}>
                        <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={isSaving}>
                            <Text style={styles.cancelText}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.saveButton, (!sportId || !duration || isLoading) && styles.saveButtonDisabled]}
                            onPress={handleSave}
                            disabled={isSaving || !sportId || !duration || isLoading}
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
    pickerWrapper: {
        borderWidth: 1,
        borderColor: '#e0e0e0',
        borderRadius: 10,
        backgroundColor: '#fafafa',
        overflow: 'hidden',
    },
    picker: {
        height: 50,
        width: '100%',
    },
    numericInput: {
        borderWidth: 1,
        borderColor: '#e0e0e0',
        borderRadius: 10,
        height: 50,
        fontSize: 20,
        textAlign: 'center',
        color: '#263238',
        backgroundColor: '#fafafa',
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
        backgroundColor: '#ff9800', // Naranja para deporte
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveButtonDisabled: {
        backgroundColor: '#ffcc80',
    },
    saveText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
});

export default ExerciseModal;
