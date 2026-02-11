import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './src/screens/LoginScreen';
import ProfessorHome from './src/screens/Professor/ProfessorHome';
import AlunoHome from './src/screens/Aluno/AlunoHome';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="ProfessorHome" component={ProfessorHome} options={{ title: 'Professor' }} />
        <Stack.Screen name="AlunoHome" component={AlunoHome} options={{ title: 'Aluno' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
