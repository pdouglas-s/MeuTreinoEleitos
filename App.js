import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './src/screens/LoginScreen';
import ProfessorHome from './src/screens/Professor/ProfessorHome';
import AlunoHome from './src/screens/Aluno/AlunoHome';
import TreinoDetail from './src/screens/TreinoDetail';
import ChangePassword from './src/screens/ChangePassword';
import { ThemeContext, light, dark } from './src/theme';

const Stack = createNativeStackNavigator();

export default function App() {
  const [theme, setTheme] = useState(light);
  function toggle() { setTheme((t) => (t === light ? dark : light)); }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Login">
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="ProfessorHome" component={ProfessorHome} options={{ title: 'Professor' }} />
          <Stack.Screen name="AlunoHome" component={AlunoHome} options={{ title: 'Aluno' }} />
          <Stack.Screen name="TreinoDetail" component={TreinoDetail} options={{ title: 'Treino' }} />
          <Stack.Screen name="ChangePassword" component={ChangePassword} options={{ title: 'Trocar Senha' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeContext.Provider>
  );
}
