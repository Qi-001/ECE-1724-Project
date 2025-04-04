'use server';

import prisma  from '@/lib/prisma';
import { authClient } from '@/lib/auth-client';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, BUCKET_NAME } from './spaces-config';

export async function createGroup(name: string, description: string | null, id: string) {
  try {
    //const session = await (authClient as any).getSession();
    // const session = await authClient.getSession();
    // console.log('Session data:', session);
    // if (!session?.data?.user?.id) {
    //   throw new Error('Not authenticated');
    // }

    const group = await prisma.group.create({
      data: {
        name,
        description,
        adminId: id,
        members: {
          create: {
            userId: id,
            role: 'ADMIN'
          }
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true
              }
            }
          }
        },
        documents: true
      }
    });

    return { success: true, data: group };
  } catch (error) {
    console.error('Error creating group:', error);
    return { success: false, error: 'Failed to create group' };
  }
}

export async function uploadGroupFile(file: File, groupId: string, id: string) {
  try {
    // const session = await (authClient as any).getSession();
    // if (!session?.user?.id) {
    //   throw new Error('Not authenticated');
    // }

    // Generate unique file name
    const fileExtension = file.name.split('.').pop();
    const uniqueFileName = `${groupId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;

    // Upload to DO Spaces
    const arrayBuffer = await file.arrayBuffer();
    const uploadCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: uniqueFileName,
      Body: Buffer.from(arrayBuffer),
      ContentType: file.type,
      ACL: 'public-read',
    });

    await s3Client.send(uploadCommand);

    // Create document record in database
    const document = await prisma.document.create({
      data: {
        title: file.name,
        cloudStorageUrl: `https://${BUCKET_NAME}.${process.env.DO_SPACES_ENDPOINT}/${uniqueFileName}`,
        uploaderId: id,
        groupId: groupId,
      }
    });

    return { success: true, data: document };
  } catch (error) {
    console.error('Error uploading file:', error);
    return { success: false, error: 'Failed to upload file' };
  }
}
