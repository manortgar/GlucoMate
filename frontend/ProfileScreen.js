import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    ScrollView, ActivityIndicator, Platform
} from 'react-native';
import { Picker } from '@react-native-picker/picker';

const BACKEND_URL = 'http://192.168.1.18:3000';

const MEAL_LABELS = [
    { key: 'icr_breakfast',   label: '🌅 Desayuno' },
    { key: 'icr_mid_morning', label: '☕ Media Mañana' },
    { key: 'icr_lunch',       label: '🍽️ Almuerzo' },
    { key: 'icr_snack',       label: '🍎 Merienda' },
    { key: 'icr_dinner',      label: '🌙 Cena' },
];

const ProfileScreen = () => {
    const [insulins, setInsulins] = useState([]);
    const [fastInsulins, setFastInsulins] = useState([]);
    const [slowInsulins, setSlowInsulins] = useState([]);

    const [fastInsulinId, setFastInsulinId] = useState(null);
    const [slowInsulinId, setSlowInsulinId] = useState(null);
    const [icrValues, setIcrValues] = useState({
        icr_breakfast: '', icr_mid_morning: '', icr_lunch: '',
        icr_snack: '', icr_dinner: ''
    });
    const [fsi, setFsi] = useState('');

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState(null); // null | 'ok' | 'error'

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            // Cargar catálogo de insulinas
            const insRes = await fetch(`${BACKEND_URL}/api/insulins`);
            const insData = await insRes.json();
            setInsulins(insData);
            setFastInsulins(insData.filter(i => i.type === 'fast'));
            setSlowInsulins(insData.filter(i => i.type === 'slow'));

            // Cargar perfil guardado
            const profRes = await fetch(`${BACKEND_URL}/api/profile`);
            const profData = await profRes.json();
            if (profData) {
                setFastInsulinId(profData.fast_insulin_id ? String(profData.fast_insulin_id) : null);
                setSlowInsulinId(profData.slow_insulin_id ? String(profData.slow_insulin_id) : null);
                setIcrValues({
                    icr_breakfast:   String(profData.icr_breakfast   ?? ''),
                    icr_mid_morning: String(profData.icr_mid_morning ?? ''),
                    icr_lunch:       String(profData.icr_lunch       ?? ''),
                    icr_snack:       String(profData.icr_snack       ?? ''),
                    icr_dinner:      String(profData.icr_dinner      ?? ''),
                });
                setFsi(String(profData.fsi ?? ''));
            }
        } catch (err) {
            console.error('Error cargando datos del perfil:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleSave = async () => {
        setIsSaving(true);
        setSaveStatus(null);
        try {
            const payload = {
                fast_insulin_id: fastInsulinId ? parseInt(fastInsulinId) : null,
                slow_insulin_id: slowInsulinId ? parseInt(slowInsulinId) : null,
                icr_breakfast:   parseFloat(icrValues.icr_breakfast)   || null,
                icr_mid_morning: parseFloat(icrValues.icr_mid_morning) || null,
                icr_lunch:       parseFloat(icrValues.icr_lunch)       || null,
                icr_snack:       parseFloat(icrValues.icr_snack)       || null,
                icr_dinner:      parseFloat(icrValues.icr_dinner)      || null,
                fsi:             parseFloat(fsi)                       || null,
            };
            const res = await fetch(`${BACKEND_URL}/api/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            setSaveStatus(res.ok ? 'ok' : 'error');
        } catch (err) {
            console.error('Error guardando perfil:', err);
            setSaveStatus('error');
        } finally {
            setIsSaving(false);
            setTimeout(() => setSaveStatus(null), 3000); // Reset feedback tras 3s
        }
    };

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#2196F3" />
                <Text style={styles.loadingText}>Cargando perfil...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.pageTitle}>Mi Perfil de Tratamiento</Text>

            {/* ─── SECCIÓN 1: Insulinas ─── */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>💉 Mis Insulinas</Text>

                <Text style={styles.label}>Insulina rápida (bolos de comida)</Text>
                <View style={styles.pickerWrapper}>
                    <Picker
                        selectedValue={fastInsulinId}
                        onValueChange={val => setFastInsulinId(val)}
                        style={styles.picker}
                    >
                        <Picker.Item label="-- Seleccionar --" value={null} />
                        {fastInsulins.map(ins => (
                            <Picker.Item
                                key={ins.id}
                                label={`${ins.name}  (${ins.duration_hours}h)`}
                                value={String(ins.id)}
                            />
                        ))}
                    </Picker>
                </View>

                <Text style={styles.label}>Insulina lenta (basal)</Text>
                <View style={styles.pickerWrapper}>
                    <Picker
                        selectedValue={slowInsulinId}
                        onValueChange={val => setSlowInsulinId(val)}
                        style={styles.picker}
                    >
                        <Picker.Item label="-- Seleccionar --" value={null} />
                        {slowInsulins.map(ins => (
                            <Picker.Item
                                key={ins.id}
                                label={`${ins.name}  (${ins.duration_hours}h)`}
                                value={String(ins.id)}
                            />
                        ))}
                    </Picker>
                </View>
            </View>

            {/* ─── SECCIÓN 2: Ratios ICR ─── */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>⚖️ Ratios ICR (g HC / 1 unidad)</Text>
                <Text style={styles.hint}>Indica cuántos gramos de carbohidratos cubre 1 unidad de insulina en cada comida.</Text>
                {MEAL_LABELS.map(meal => (
                    <View key={meal.key} style={styles.inputRow}>
                        <Text style={styles.mealLabel}>{meal.label}</Text>
                        <View style={styles.inputWrapper}>
                            <TextInput
                                style={styles.input}
                                keyboardType="decimal-pad"
                                placeholder="ej. 10"
                                placeholderTextColor="#bdbdbd"
                                value={icrValues[meal.key]}
                                onChangeText={val => setIcrValues(prev => ({ ...prev, [meal.key]: val }))}
                            />
                            <Text style={styles.inputUnit}>g/U</Text>
                        </View>
                    </View>
                ))}
            </View>

            {/* ─── SECCIÓN 3: FSI ─── */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>🎯 Bolo de Corrección (FSI)</Text>
                <Text style={styles.hint}>Cuántos mg/dL reduce tu glucosa 1 unidad de insulina rápida.</Text>
                <View style={styles.inputRow}>
                    <Text style={styles.mealLabel}>Sensibilidad</Text>
                    <View style={styles.inputWrapper}>
                        <TextInput
                            style={styles.input}
                            keyboardType="decimal-pad"
                            placeholder="ej. 40"
                            placeholderTextColor="#bdbdbd"
                            value={fsi}
                            onChangeText={setFsi}
                        />
                        <Text style={styles.inputUnit}>mg/dL</Text>
                    </View>
                </View>
            </View>

            {/* ─── BOTÓN GUARDAR ─── */}
            <TouchableOpacity
                style={[
                    styles.saveButton,
                    saveStatus === 'ok'    && styles.saveButtonOk,
                    saveStatus === 'error' && styles.saveButtonError,
                ]}
                onPress={handleSave}
                disabled={isSaving}
            >
                {isSaving
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.saveButtonText}>
                        {saveStatus === 'ok'    ? '✅ Guardado' :
                         saveStatus === 'error' ? '❌ Error al guardar' :
                         'Guardar Perfil'}
                    </Text>
                }
            </TouchableOpacity>

            <View style={{ height: 40 }} />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fafafa' },
    loadingText: { marginTop: 12, color: '#757575', fontSize: 16 },
    container: { flex: 1, backgroundColor: '#f0f4f8' },
    content: { padding: 20, paddingTop: 60 },
    pageTitle: {
        fontSize: 26, fontWeight: '800', color: '#1a237e',
        marginBottom: 24, textAlign: 'center', letterSpacing: -0.5,
    },
    section: {
        backgroundColor: '#fff', borderRadius: 16,
        padding: 18, marginBottom: 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
    },
    sectionTitle: { fontSize: 17, fontWeight: '700', color: '#263238', marginBottom: 4 },
    hint: { fontSize: 13, color: '#90a4ae', marginBottom: 14 },
    label: { fontSize: 14, color: '#546e7a', marginTop: 12, marginBottom: 4, fontWeight: '600' },
    pickerWrapper: {
        borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10,
        overflow: 'hidden', backgroundColor: '#f9f9f9',
    },
    picker: { height: 50, color: '#263238' },
    inputRow: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 10,
    },
    mealLabel: { flex: 1, fontSize: 14, color: '#546e7a', fontWeight: '500' },
    inputWrapper: {
        flexDirection: 'row', alignItems: 'center',
        borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10,
        backgroundColor: '#f9f9f9', paddingHorizontal: 10,
    },
    input: {
        width: 70, height: 44, fontSize: 16,
        color: '#263238', textAlign: 'right',
    },
    inputUnit: { marginLeft: 6, fontSize: 13, color: '#90a4ae', width: 34 },
    saveButton: {
        backgroundColor: '#2196F3', borderRadius: 14,
        paddingVertical: 16, alignItems: 'center', marginTop: 8,
        shadowColor: '#2196F3', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
    },
    saveButtonOk:    { backgroundColor: '#4caf50' },
    saveButtonError: { backgroundColor: '#f44336' },
    saveButtonText:  { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
});

export default ProfileScreen;
