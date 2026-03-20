import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import GlucoseScanner from './NFCScanner';
import ProfileScreen from './ProfileScreen';

const Tab = createBottomTabNavigator();

export default function App() {
    return (
        <NavigationContainer>
            <StatusBar style="dark" />
            <Tab.Navigator
                screenOptions={({ route }) => ({
                    headerShown: false,
                    tabBarActiveTintColor: '#2196F3',
                    tabBarInactiveTintColor: '#9e9e9e',
                    tabBarStyle: {
                        backgroundColor: '#ffffff',
                        borderTopColor: '#e0e0e0',
                        height: 65,
                        paddingBottom: 10,
                        paddingTop: 6,
                        elevation: 8,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: -2 },
                        shadowOpacity: 0.08,
                        shadowRadius: 6,
                    },
                    tabBarLabelStyle: {
                        fontSize: 12,
                        fontWeight: '600',
                    },
                    tabBarIcon: ({ focused, color, size }) => {
                        let iconName;
                        if (route.name === 'Glucosa') {
                            iconName = focused ? 'chart-line' : 'chart-line-variant';
                        } else if (route.name === 'Mi Perfil') {
                            iconName = focused ? 'account-heart' : 'account-heart-outline';
                        }
                        return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
                    },
                })}
            >
                <Tab.Screen name="Glucosa" component={GlucoseScanner} />
                <Tab.Screen name="Mi Perfil" component={ProfileScreen} />
            </Tab.Navigator>
        </NavigationContainer>
    );
}
