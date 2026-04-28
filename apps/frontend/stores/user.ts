import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUserStore = defineStore('user', () => {
  const id = ref<string>('');
  const name = ref<string>('');
  const isAI = ref(false);

  function setUser(user: { id: string; name: string; isAI: boolean }) {
    id.value = user.id;
    name.value = user.name;
    isAI.value = user.isAI;
  }

  return { id, name, isAI, setUser };
});
