'use server';

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import bcrypt from 'bcrypt';

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9]/g, ""); // remove non-alphanumeric characters
}

export async function updateUserProfile({
  name,
  firstName,
  phone,
  email,
  login,
  currentPassword,
  newPassword,
}: {
  name: string;
  firstName?: string;
  phone?: string;
  email: string;
  login?: string;
  currentPassword?: string;
  newPassword?: string;
}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      throw new Error('Non autorisé');
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }

    // Check email uniqueness if email is changed
    if (email !== user.email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        throw new Error('Cette adresse email est déjà utilisée par un autre utilisateur');
      }
    }

    // Check login uniqueness if login is changed
    if (login && login.trim() !== '' && login !== user.login) {
      const existing = await prisma.user.findUnique({ where: { login } });
      if (existing) {
        throw new Error('Cet identifiant est déjà utilisé par un autre utilisateur');
      }
    }

    const data: any = {
      name,
      firstName: firstName || null,
      phone: phone || null,
      email,
      login: login || null,
    };

    // If new password is provided, we must verify the current password first
    if (newPassword && newPassword.trim() !== '') {
      if (!currentPassword) {
        throw new Error('Le mot de passe actuel est requis pour changer de mot de passe');
      }

      const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isPasswordValid) {
        throw new Error('Le mot de passe actuel est incorrect');
      }

      data.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data,
    });

    return {
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        firstName: updatedUser.firstName,
        phone: updatedUser.phone,
        email: updatedUser.email,
        login: updatedUser.login,
        role: updatedUser.role,
      },
    };
  } catch (error: any) {
    console.error('Error updating user profile:', error);
    throw new Error(error.message || 'Impossible de mettre à jour le profil');
  }
}

export async function getUsers() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email || session.user?.role !== 'ADMIN') {
      throw new Error('Non autorisé - Rôle Administrateur requis');
    }

    const users = await prisma.user.findMany({
      orderBy: [
        { name: 'asc' },
        { firstName: 'asc' },
      ],
    });

    // Automatically heal any users with null logins (e.g. existing accounts)
    const updatedUsers = await Promise.all(
      users.map(async (u) => {
        if (!u.login) {
          const p = u.firstName ? slugify(u.firstName) : '';
          const n = u.name ? slugify(u.name) : '';
          let base = (p && n) ? `${p}.${n}` : (p || n || 'user');
          let finalLogin = base;
          let isUnique = false;
          let attempts = 0;
          while (!isUnique && attempts < 100) {
            const existing = await prisma.user.findUnique({
              where: { login: finalLogin }
            });
            if (!existing || existing.id === u.id) {
              isUnique = true;
            } else {
              const rand = Math.floor(100 + Math.random() * 900);
              finalLogin = `${base}${rand}`;
              attempts++;
            }
          }
          
          await prisma.user.update({
            where: { id: u.id },
            data: { login: finalLogin }
          });
          u.login = finalLogin;
        }
        return u;
      })
    );

    return updatedUsers.map(u => ({
      id: u.id,
      name: u.name,
      firstName: u.firstName,
      phone: u.phone,
      email: u.email,
      login: u.login,
      role: u.role,
      createdAt: u.createdAt,
    }));
  } catch (error: any) {
    console.error('Error fetching users:', error);
    throw new Error(error.message || 'Impossible de récupérer la liste des utilisateurs');
  }
}

export async function adminCreateUser(data: {
  name: string;
  firstName?: string;
  phone?: string;
  email: string;
  login?: string;
  role: string;
  passwordHash: string;
}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'ADMIN') {
      throw new Error('Non autorisé - Rôle Administrateur requis');
    }

    // Check duplicate email
    const existingEmail = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existingEmail) {
      throw new Error('Un utilisateur avec cette adresse email existe déjà');
    }

    // Determine base login (automatically generate from firstName and name if not provided)
    let userLogin = data.login && data.login.trim() !== '' ? data.login.trim() : '';
    if (userLogin === '') {
      const p = data.firstName ? slugify(data.firstName) : '';
      const n = data.name ? slugify(data.name) : '';
      if (p && n) {
        userLogin = `${p}.${n}`;
      } else {
        userLogin = p || n || 'user';
      }
    } else {
      userLogin = userLogin.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9._-]/g, "");
    }

    // Ensure generated/supplied login is unique (auto append 3 digits number if conflicting)
    let finalLogin = userLogin;
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 100) {
      const existing = await prisma.user.findUnique({
        where: { login: finalLogin },
      });
      if (!existing) {
        isUnique = true;
      } else {
        const rand = Math.floor(100 + Math.random() * 900); // 100 to 999
        finalLogin = `${userLogin}${rand}`;
        attempts++;
      }
    }

    const hashedPassword = await bcrypt.hash(data.passwordHash, 10);

    const newUser = await prisma.user.create({
      data: {
        name: data.name,
        firstName: data.firstName || null,
        phone: data.phone || null,
        email: data.email,
        login: finalLogin,
        role: data.role,
        passwordHash: hashedPassword,
      },
    });

    return {
      success: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        firstName: newUser.firstName,
        email: newUser.email,
        login: newUser.login,
        role: newUser.role,
      },
    };
  } catch (error: any) {
    console.error('Error creating user:', error);
    throw new Error(error.message || 'Impossible de créer le compte');
  }
}

export async function adminUpdateUser(
  id: string,
  data: {
    name: string;
    firstName?: string;
    phone?: string;
    email: string;
    login?: string;
    role: string;
    newPassword?: string;
  }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'ADMIN') {
      throw new Error('Non autorisé - Rôle Administrateur requis');
    }

    // Check unique email
    const existingEmail = await prisma.user.findFirst({
      where: {
        email: data.email,
        NOT: { id },
      },
    });
    if (existingEmail) {
      throw new Error('Un autre utilisateur utilise déjà cette adresse email');
    }

    // Check unique login
    if (data.login && data.login.trim() !== '') {
      const existingLogin = await prisma.user.findFirst({
        where: {
          login: data.login,
          NOT: { id },
        },
      });
      if (existingLogin) {
        throw new Error('Un autre utilisateur utilise déjà cet identifiant');
      }
    }

    const updateData: any = {
      name: data.name,
      firstName: data.firstName || null,
      phone: data.phone || null,
      email: data.email,
      login: data.login || null,
      role: data.role,
    };

    if (data.newPassword && data.newPassword.trim() !== '') {
      updateData.passwordHash = await bcrypt.hash(data.newPassword, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    return {
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        firstName: updatedUser.firstName,
        email: updatedUser.email,
        login: updatedUser.login,
        role: updatedUser.role,
      },
    };
  } catch (error: any) {
    console.error('Error updating user:', error);
    throw new Error(error.message || 'Impossible de modifier le compte');
  }
}

export async function adminDeleteUser(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email || session.user?.role !== 'ADMIN') {
      throw new Error('Non autorisé - Rôle Administrateur requis');
    }

    // Prevent self-deletion
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (currentUser?.id === id) {
      throw new Error('Vous ne pouvez pas supprimer votre propre compte');
    }

    await prisma.user.delete({
      where: { id },
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting user:', error);
    throw new Error(error.message || 'Impossible de supprimer le compte');
  }
}
