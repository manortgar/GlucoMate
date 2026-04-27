import React, { useState, useRef, useEffect } from 'react';
import {
    Modal, View, Text, TextInput, TouchableOpacity,
    StyleSheet, ActivityIndicator, ScrollView,
    KeyboardAvoidingView, Keyboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const ChatModal = ({ visible, onClose, backendUrl }) => {
    const [messages, setMessages] = useState([
        { role: 'model', content: '¡Hola! Soy GlucoMate AI, tu agente inteligente 🤖. Conozco tu glucosa, tu perfil y lo que has comido o inyectado últimamente. ¿En qué te puedo ayudar?' }
    ]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);
    const scrollViewRef = useRef();

    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener(
            'keyboardDidShow',
            () => setKeyboardVisible(true)
        );
        const keyboardDidHideListener = Keyboard.addListener(
            'keyboardDidHide',
            () => setKeyboardVisible(false)
        );

        return () => {
            keyboardDidHideListener.remove();
            keyboardDidShowListener.remove();
        };
    }, []);

    const handleSend = async () => {
        if (!inputText.trim()) return;

        const userMsg = { role: 'user', content: inputText.trim() };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setInputText('');
        setIsLoading(true);

        try {
            const baseUrl = backendUrl.split('/api/')[0];
            const history = messages.slice(1).map(m => ({ role: m.role, content: m.content }));

            const res = await fetch(`${baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMsg.content,
                    history: history
                })
            });

            const data = await res.json();

            if (res.ok) {
                setMessages([...newMessages, { role: 'model', content: data.reply }]);
            } else {
                setMessages([...newMessages, { role: 'model', content: '❌ Error: ' + (data.error || 'Fallo desconocido.') }]);
            }
        } catch (error) {
            setMessages([...newMessages, { role: 'model', content: '❌ Error al comunicar con el cerebro de IA.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            onRequestClose={onClose}
        >
            <SafeAreaView style={styles.container}>
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior="padding"
                >
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.backButton}>
                            <MaterialCommunityIcons name="chevron-down" size={32} color="#1a237e" />
                        </TouchableOpacity>
                        <View style={styles.headerTitles}>
                            <Text style={styles.title}>GlucoMate AI</Text>
                            <Text style={styles.subtitle}>✨ Asistente de diabetes</Text>
                        </View>
                        <View style={{ width: 32 }} />
                    </View>

                    <ScrollView
                        style={styles.chatArea}
                        contentContainerStyle={styles.chatContent}
                        ref={scrollViewRef}
                        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
                    >
                        {messages.map((msg, index) => {
                            const isModel = msg.role === 'model';
                            return (
                                <View key={index} style={[styles.bubbleWrapper, isModel ? styles.bubbleWrapperLeft : styles.bubbleWrapperRight]}>
                                    {isModel && (
                                        <View style={styles.avatar}>
                                            <Text style={{ fontSize: 16 }}>🤖</Text>
                                        </View>
                                    )}
                                    <View style={[styles.bubble, isModel ? styles.bubbleModel : styles.bubbleUser]}>
                                        <Text style={[styles.messageText, isModel ? styles.messageTextModel : styles.messageTextUser]}>
                                            {msg.content}
                                        </Text>
                                    </View>
                                </View>
                            );
                        })}
                        {isLoading && (
                            <View style={[styles.bubbleWrapper, styles.bubbleWrapperLeft]}>
                                <View style={styles.avatar}>
                                    <Text style={{ fontSize: 16 }}>🤖</Text>
                                </View>
                                <View style={styles.typingIndicator}>
                                    <ActivityIndicator size="small" color="#2196F3" />
                                    <Text style={styles.typingText}>Analizando fisiología...</Text>
                                </View>
                            </View>
                        )}
                    </ScrollView>

                    <View style={[styles.inputArea, { paddingBottom: isKeyboardVisible ? 12 : 30 }]}>
                        <TextInput
                            style={styles.textInput}
                            placeholder="Pregúntale algo sobre tus datos..."
                            placeholderTextColor="#9e9e9e"
                            value={inputText}
                            onChangeText={setInputText}
                            multiline={true}
                            onSubmitEditing={handleSend}
                        />
                        <TouchableOpacity
                            style={[styles.sendButton, !inputText.trim() && { opacity: 0.5 }]}
                            onPress={handleSend}
                            disabled={!inputText.trim() || isLoading}
                        >
                            <MaterialCommunityIcons name="send" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingTop: 15, // Extra padding para la cámara
        paddingBottom: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderColor: '#e0e0e0',
        elevation: 2,
    },
    backButton: {
        padding: 5,
    },
    headerTitles: {
        flex: 1,
        alignItems: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a237e',
    },
    subtitle: {
        fontSize: 12,
        color: '#2196F3',
        fontWeight: '600',
    },
    chatArea: {
        flex: 1,
    },
    chatContent: {
        padding: 15,
        paddingBottom: 20,
    },
    bubbleWrapper: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginBottom: 16,
    },
    bubbleWrapperLeft: {
        justifyContent: 'flex-start',
        paddingRight: 50,
    },
    bubbleWrapperRight: {
        justifyContent: 'flex-end',
        paddingLeft: 50,
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#e3f2fd',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    bubble: {
        padding: 14,
        borderRadius: 20,
        maxWidth: '100%',
    },
    bubbleModel: {
        backgroundColor: '#fff',
        borderBottomLeftRadius: 4,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    bubbleUser: {
        backgroundColor: '#2196F3',
        borderBottomRightRadius: 4,
    },
    messageText: {
        fontSize: 15,
        lineHeight: 22,
    },
    messageTextModel: {
        color: '#263238',
    },
    messageTextUser: {
        color: '#fff',
    },
    typingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 20,
        borderBottomLeftRadius: 4,
    },
    typingText: {
        marginLeft: 8,
        color: '#757575',
        fontSize: 13,
        fontStyle: 'italic',
    },
    inputArea: {
        flexDirection: 'row',
        padding: 12,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderColor: '#e0e0e0',
        alignItems: 'flex-end',
    },
    textInput: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 12,
        maxHeight: 100,
        fontSize: 15,
        color: '#263238',
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#2196F3',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
        marginBottom: 2,
    },
});

export default ChatModal;
